import type {
  NoteExportDrawingPreview,
  NoteExportFormat,
  NoteExportPayload,
  NoteExportResponse,
} from './types/ipc'
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import MarkdownIt from 'markdown-it'
import {
  getNotesPaths,
  resolveNotesAsset,
} from './storage/providers/markdown/notes/runtime'
import {
  getVaultPath,
  INVALID_NAME_CHARS_RE,
  WINDOWS_RESERVED_NAME_RE,
} from './storage/providers/markdown/runtime'

type NotesAssetResolver = (fileName: string) => Promise<Response>

class NotesAssetTemporarilyUnavailableError extends Error {}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
})

const LEADING_FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

const MAX_EXPORT_FILE_NAME_BYTES = 240
const MAX_DRAWING_PREVIEWS = 50
const MAX_DRAWING_PREVIEW_BYTES = 5 * 1024 * 1024
const MAX_DRAWING_PREVIEWS_TOTAL_BYTES = 20 * 1024 * 1024

const DOCUMENT_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 32px;
    color: #1f2328;
    background: #fff;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow-wrap: break-word;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; }
  a { color: #0969da; }
  img {
    display: block;
    max-width: 100%;
    height: auto;
    border: 1px solid #d1d9e0;
    border-radius: 8px;
  }
  img.drawing-preview {
    padding: 16px;
    border-radius: 6px;
  }
  blockquote {
    margin-left: 0;
    padding-left: 1em;
    color: #59636e;
    border-left: 4px solid #d1d9e0;
  }
  pre {
    padding: 16px;
    overflow: visible;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: #f6f8fa;
    border-radius: 6px;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }
  :not(pre) > code {
    padding: 0.15em 0.35em;
    background: #f6f8fa;
    border-radius: 4px;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 13px; border: 1px solid #d1d9e0; }
  tr:nth-child(2n) { background: #f6f8fa; }
  @page { size: auto; margin: 18mm; }
  @media print {
    body { max-width: none; padding: 0; }
    pre, blockquote, img, table { break-inside: avoid; }
  }
`

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
      })[character]!,
  )
}

function renderMarkdownContent(content: string): string {
  const frontmatterMatch = content.match(LEADING_FRONTMATTER_RE)
  if (!frontmatterMatch) {
    return markdown.render(content)
  }

  const [, frontmatter, body] = frontmatterMatch
  const frontmatterSource = `---\n${frontmatter}\n---`

  return [
    `<pre class="frontmatter"><code class="language-yaml">${escapeHtml(frontmatterSource)}</code></pre>`,
    markdown.render(body),
  ].join('\n')
}

export function sanitizeNoteExportFileName(
  name: string,
  format: NoteExportFormat,
): string {
  let safeName = name
    .replace(INVALID_NAME_CHARS_RE, '-')
    .split('')
    .map(character => (character.charCodeAt(0) <= 0x1F ? '-' : character))
    .join('')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')

  if (!safeName) {
    safeName = 'note'
  }
  else if (WINDOWS_RESERVED_NAME_RE.test(safeName)) {
    safeName = `_${safeName}`
  }

  const extension = `.${format}`
  const maxNameBytes
    = MAX_EXPORT_FILE_NAME_BYTES - Buffer.byteLength(extension)
  let truncatedName = ''
  let byteLength = 0
  for (const character of safeName) {
    const characterBytes = Buffer.byteLength(character)
    if (byteLength + characterBytes > maxNameBytes) {
      break
    }
    truncatedName += character
    byteLength += characterBytes
  }

  return `${truncatedName || 'note'}${extension}`
}

export function parseNoteExportPayload(
  payload: unknown,
): NoteExportPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Partial<NoteExportPayload>
  if (
    typeof candidate.name !== 'string'
    || typeof candidate.content !== 'string'
    || (candidate.format !== 'html' && candidate.format !== 'pdf')
  ) {
    return null
  }

  let drawingPreviews: NoteExportDrawingPreview[] | undefined
  if (candidate.drawingPreviews !== undefined) {
    if (
      !Array.isArray(candidate.drawingPreviews)
      || candidate.drawingPreviews.length > MAX_DRAWING_PREVIEWS
    ) {
      return null
    }

    let totalBytes = 0
    drawingPreviews = []
    for (const preview of candidate.drawingPreviews) {
      if (
        !preview
        || typeof preview !== 'object'
        || typeof preview.id !== 'string'
        || typeof preview.svg !== 'string'
      ) {
        return null
      }

      const previewBytes
        = Buffer.byteLength(preview.id) + Buffer.byteLength(preview.svg)
      totalBytes += previewBytes
      if (
        previewBytes > MAX_DRAWING_PREVIEW_BYTES
        || totalBytes > MAX_DRAWING_PREVIEWS_TOTAL_BYTES
      ) {
        return null
      }

      drawingPreviews.push({
        id: preview.id,
        svg: preview.svg,
      })
    }
  }

  return {
    content: candidate.content,
    ...(drawingPreviews === undefined ? {} : { drawingPreviews }),
    format: candidate.format,
    name: candidate.name,
  }
}

async function defaultAssetResolver(fileName: string): Promise<Response> {
  return resolveNotesAsset(fileName, getNotesPaths(getVaultPath()))
}

async function embedManagedAssets(
  html: string,
  resolveAsset: NotesAssetResolver,
): Promise<string> {
  const sourcePattern = /\bsrc="masscode:\/\/notes-asset\/([^"]+)"/g
  const matches = [...html.matchAll(sourcePattern)]

  await Promise.all(
    matches.map(async (match) => {
      const [attribute, fileName] = match
      try {
        const response = await resolveAsset(fileName)
        if (response.status === 503) {
          throw new NotesAssetTemporarilyUnavailableError(
            'Notes asset is temporarily unavailable',
          )
        }
        if (!response.ok) {
          return
        }

        const mimeType = response.headers.get('content-type')
        if (!mimeType?.startsWith('image/')) {
          return
        }

        const dataUri = `data:${mimeType};base64,${Buffer.from(
          await response.arrayBuffer(),
        ).toString('base64')}`
        html = html.replace(attribute, `src="${dataUri}"`)
      }
      catch (error) {
        if (error instanceof NotesAssetTemporarilyUnavailableError) {
          throw error
        }
        // A missing or unavailable asset must not prevent exporting the note.
      }
    }),
  )

  return html
}

function isSafeDrawingSvg(svg: string): boolean {
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg)) {
    return false
  }

  return !(
    /<(?:script|foreignObject)\b/i.test(svg)
    || /\bon[a-z]+\s*=/i.test(svg)
    || /javascript\s*:/i.test(svg)
    || /\b(?:href|src)\s*=\s*["']\s*https?:/i.test(svg)
    || /url\([^)]*https?:/i.test(svg)
  )
}

function embedDrawingPreviews(
  html: string,
  drawingPreviews: NoteExportDrawingPreview[],
): string {
  const previewsById = new Map(
    drawingPreviews
      .filter(preview => isSafeDrawingSvg(preview.svg))
      .map(preview => [preview.id, preview.svg]),
  )

  return html.replace(
    /<img src="masscode:\/\/drawing\/([^"]+)"([^>]*)>/g,
    (image, rawId: string, after: string) => {
      let drawingId = rawId
      try {
        drawingId = decodeURIComponent(rawId)
      }
      catch {
        // Match renderer URL decoding: malformed escapes fall back to raw id.
      }

      const svg = previewsById.get(drawingId)
      if (svg === undefined) {
        return image
      }

      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString(
        'base64',
      )}`
      return `<img src="${dataUri}" class="drawing-preview"${after}>`
    },
  )
}

export async function renderNoteHtml(
  name: string,
  content: string,
  resolveAsset: NotesAssetResolver = defaultAssetResolver,
  drawingPreviews: NoteExportDrawingPreview[] = [],
): Promise<string> {
  const bodyWithAssets = await embedManagedAssets(
    renderMarkdownContent(content),
    resolveAsset,
  )
  const body = embedDrawingPreviews(bodyWithAssets, drawingPreviews)
  const title = escapeHtml(name)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
  <title>${title}</title>
  <style>${DOCUMENT_STYLES}</style>
</head>
<body>
${body}</body>
</html>
`
}

async function chooseDestination(
  format: NoteExportFormat,
  name: string,
): Promise<string | null> {
  const options = {
    defaultPath: sanitizeNoteExportFileName(name, format),
    filters: [
      {
        extensions: [format],
        name: format.toUpperCase(),
      },
    ],
  }
  const parentWindow = BrowserWindow.getFocusedWindow()
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, options)
    : await dialog.showSaveDialog(options)

  return result.canceled ? null : result.filePath
}

async function exportPdf(destinationPath: string, html: string): Promise<void> {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'masscode-note-export-'))
  const htmlPath = join(tempDirectory, 'note.html')
  let pdfWindow: BrowserWindow | undefined

  try {
    await writeFile(htmlPath, html, 'utf8')
    pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await pdfWindow.loadFile(htmlPath)
    const pdf = await pdfWindow.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
    })
    await writeFileAtomically(destinationPath, pdf)
  }
  finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      try {
        pdfWindow.destroy()
      }
      catch (error) {
        console.warn('Failed to destroy note export window', error)
      }
    }
    try {
      await rm(tempDirectory, { force: true, recursive: true })
    }
    catch (error) {
      // Cleanup is best-effort and must not mask a successful write or
      // the original export error.
      console.warn('Failed to clean note export temporary directory', error)
    }
  }
}

export async function writeFileAtomically(
  destinationPath: string,
  data: string | Uint8Array,
): Promise<void> {
  const tempPath = join(
    dirname(destinationPath),
    `.masscode-export-${randomBytes(8).toString('hex')}.tmp`,
  )

  try {
    await writeFile(tempPath, data, { flag: 'wx', mode: 0o600 })
    await rename(tempPath, destinationPath)
  }
  finally {
    await rm(tempPath, { force: true })
  }
}

export async function exportNote(
  payload: NoteExportPayload,
): Promise<NoteExportResponse> {
  const destinationPath = await chooseDestination(payload.format, payload.name)
  if (!destinationPath) {
    return { canceled: true }
  }

  const html = await renderNoteHtml(
    payload.name,
    payload.content,
    defaultAssetResolver,
    payload.drawingPreviews,
  )
  if (payload.format === 'html') {
    await writeFileAtomically(destinationPath, html)
  }
  else {
    await exportPdf(destinationPath, html)
  }

  return { canceled: false, filePath: destinationPath }
}
