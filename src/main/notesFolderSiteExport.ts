import type { OpenDialogOptions } from 'electron'
import type { NoteRecord } from './storage/contracts'
import type { NotesFolderTreeRecord } from './storage/providers/markdown/notes/runtime/types'
import type {
  NoteExportDrawingPreview,
  NoteFolderSiteExportPayload,
  NoteFolderSiteExportPreparePayload,
  NoteFolderSiteExportPrepareResponse,
  NoteFolderSiteExportResponse,
} from './types/ipc'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { getDrawingUrlsFromMarkdown } from '../shared/notes/drawingExport'
import { buildNoteFolderPathMap } from '../shared/notes/folderPath'
import {
  isSafeDrawingSvg,
  NOTE_DOCUMENT_STYLES,
  NotesAssetTemporarilyUnavailableError,
  renderNoteHtmlBody,
  sanitizeNoteExportFileName,
} from './notesExport'
import { useHttpStorage, useNotesStorage, useStorage } from './storage'
import {
  getNotesPaths,
  getNotesRuntimeCache,
  resolveNotesAsset,
} from './storage/providers/markdown/notes/runtime'
import { createInternalLinkResolver } from './storage/providers/markdown/notes/runtime/internalLinkResolver'
import { getVaultPath } from './storage/providers/markdown/runtime'
import { DRAWINGS_SPACE_ID } from './storage/providers/markdown/runtime/constants'
import { getFileAvailability } from './storage/providers/markdown/runtime/shared/cloudFiles'
import { getSpaceDirPath } from './storage/providers/markdown/runtime/spaces'

const MAX_DRAWING_PREVIEWS = 500
const MAX_DRAWING_PREVIEW_BYTES = 5 * 1024 * 1024
const MAX_DRAWING_PREVIEWS_TOTAL_BYTES = 100 * 1024 * 1024

interface FolderSiteScope {
  folder: NotesFolderTreeRecord
  folders: NotesFolderTreeRecord[]
  notes: NoteRecord[]
}

type ScopeContentAvailability = 'available' | 'cloud-unavailable'

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

function sanitizeDirectoryName(name: string): string {
  const normalized = name
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map(character => (character.charCodeAt(0) <= 0x1F ? '-' : character))
    .join('')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')

  return normalized || 'notes-site'
}

function pageFileName(note: Pick<NoteRecord, 'id' | 'name'>): string {
  return sanitizeNoteExportFileName(
    `${note.id}-${note.name.replace(/\s+/g, '-')}`,
    'html',
  )
}

function flattenScope(folder: NotesFolderTreeRecord): NotesFolderTreeRecord[] {
  return [folder, ...folder.children.flatMap(child => flattenScope(child))]
}

function findFolder(
  folders: NotesFolderTreeRecord[],
  folderId: number,
): NotesFolderTreeRecord | null {
  for (const folder of folders) {
    if (folder.id === folderId) {
      return folder
    }
    const child = findFolder(folder.children, folderId)
    if (child) {
      return child
    }
  }
  return null
}

function loadScope(
  folderId: number,
  sort: NoteFolderSiteExportPayload['sort'] = 'createdAt',
  order: NoteFolderSiteExportPayload['order'] = 'DESC',
): FolderSiteScope | null {
  const storage = useNotesStorage()
  const tree = storage.folders.getFoldersTree()
  const folder = findFolder(tree, folderId)
  if (!folder) {
    return null
  }

  const folders = flattenScope(folder)
  const folderIds = new Set(folders.map(item => item.id))
  const notes = storage.notes
    .getNotes({ isDeleted: 0, order, sort, withContent: true })
    .filter(note => note.folder && folderIds.has(note.folder.id))

  return { folder, folders, notes }
}

function hasUnavailableNotes(scope: FolderSiteScope): boolean {
  return scope.notes.some(note => note.pendingCloudDownload)
}

function getScopeContentAvailability(
  scope: FolderSiteScope,
): ScopeContentAvailability {
  const paths = getNotesPaths(getVaultPath())
  const cache = getNotesRuntimeCache(paths)

  for (const record of scope.notes) {
    const note = cache.noteById.get(record.id)
    if (!note) {
      throw new Error(`Note content is unavailable: ${record.id}`)
    }
    if (note.pendingCloudDownload) {
      return 'cloud-unavailable'
    }
    if (note.content !== null) {
      continue
    }

    const availability = getFileAvailability(
      join(paths.notesRoot, note.filePath),
    )
    if (availability.isCloudPlaceholder) {
      return 'cloud-unavailable'
    }

    throw new Error(`Note content could not be read: ${record.id}`)
  }

  return 'available'
}

function getDrawingId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'masscode:' || parsed.hostname !== 'drawing') {
      return null
    }
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || null
  }
  catch {
    return null
  }
}

function getScopeDrawingIds(scope: FolderSiteScope): string[] {
  const ids = new Set<string>()
  scope.notes.forEach((note) => {
    getDrawingUrlsFromMarkdown(note.content).forEach((url) => {
      const id = getDrawingId(url)
      if (id && !/[\\/]/.test(id)) {
        ids.add(id)
      }
    })
  })
  return [...ids]
}

function hasUnavailableDrawings(drawingIds: string[]): boolean {
  const drawingsPath = getSpaceDirPath(getVaultPath(), DRAWINGS_SPACE_ID)
  return drawingIds.some(
    id =>
      getFileAvailability(join(drawingsPath, `${id}.excalidraw`))
        .isCloudPlaceholder,
  )
}

export function parseNoteFolderSiteExportPreparePayload(
  payload: unknown,
): NoteFolderSiteExportPreparePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const folderId = (payload as Partial<NoteFolderSiteExportPreparePayload>)
    .folderId
  return Number.isSafeInteger(folderId) && Number(folderId) > 0
    ? { folderId: Number(folderId) }
    : null
}

export function parseNoteFolderSiteExportPayload(
  payload: unknown,
): NoteFolderSiteExportPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Partial<NoteFolderSiteExportPayload>
  if (
    !Number.isSafeInteger(candidate.folderId)
    || Number(candidate.folderId) <= 0
    || !['createdAt', 'updatedAt', 'name'].includes(candidate.sort ?? '')
    || !['ASC', 'DESC'].includes(candidate.order ?? '')
    || !Array.isArray(candidate.drawingPreviews)
    || candidate.drawingPreviews.length > MAX_DRAWING_PREVIEWS
  ) {
    return null
  }

  let totalBytes = 0
  const drawingPreviews: NoteExportDrawingPreview[] = []
  for (const preview of candidate.drawingPreviews) {
    if (
      !preview
      || typeof preview !== 'object'
      || typeof preview.id !== 'string'
      || typeof preview.svg !== 'string'
    ) {
      return null
    }

    const bytes
      = Buffer.byteLength(preview.id) + Buffer.byteLength(preview.svg)
    totalBytes += bytes
    if (
      bytes > MAX_DRAWING_PREVIEW_BYTES
      || totalBytes > MAX_DRAWING_PREVIEWS_TOTAL_BYTES
    ) {
      return null
    }
    drawingPreviews.push({ id: preview.id, svg: preview.svg })
  }

  return {
    drawingPreviews,
    folderId: Number(candidate.folderId),
    order: candidate.order!,
    sort: candidate.sort!,
  }
}

export function prepareNoteFolderSiteExport(
  payload: NoteFolderSiteExportPreparePayload,
): NoteFolderSiteExportPrepareResponse {
  const scope = loadScope(payload.folderId)
  if (!scope) {
    throw new Error('Notes folder not found')
  }
  if (
    hasUnavailableNotes(scope)
    || getScopeContentAvailability(scope) === 'cloud-unavailable'
  ) {
    return { status: 'cloud-unavailable' }
  }
  const drawingIds = getScopeDrawingIds(scope)
  if (drawingIds.length > MAX_DRAWING_PREVIEWS) {
    throw new Error(
      `Notes folder site export supports up to ${MAX_DRAWING_PREVIEWS} drawings`,
    )
  }
  if (hasUnavailableDrawings(drawingIds)) {
    return { status: 'cloud-unavailable' }
  }
  return {
    drawingIds,
    status: 'ready',
  }
}

async function chooseParentDirectory(
  folderName: string,
): Promise<string | null> {
  const options: OpenDialogOptions = {
    defaultPath: sanitizeDirectoryName(`${folderName} site`),
    properties: ['openDirectory', 'createDirectory'],
  }
  const parentWindow = BrowserWindow.getFocusedWindow()
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}

async function getAvailableDestination(
  parentPath: string,
  folderName: string,
): Promise<string> {
  const baseName = sanitizeDirectoryName(`${folderName} site`)
  let index = 1
  let destination = join(parentPath, baseName)
  while (await pathExists(destination)) {
    index += 1
    destination = join(parentPath, `${baseName} ${index}`)
  }
  return destination
}

const SITE_STYLES = `
${NOTE_DOCUMENT_STYLES}
body { max-width: none; margin: 0; padding: 0; }
.site-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); min-height: 100vh; }
.site-sidebar { padding: 24px 20px; border-right: 1px solid #d1d9e0; background: #f6f8fa; }
.site-title { margin: 0 0 20px; font-size: 18px; }
.site-nav, .site-nav ul { margin: 0; padding-left: 18px; list-style: none; }
.site-nav { padding-left: 0; }
.site-folder { margin: 12px 0 5px; font-weight: 600; }
.site-note { display: block; padding: 3px 0; font-weight: 400; }
.site-main { width: min(900px, 100%); padding: 40px 48px; }
.breadcrumbs { margin-bottom: 28px; color: #59636e; font-size: 14px; }
.breadcrumbs a { color: inherit; }
@media (max-width: 720px) {
  .site-layout { display: block; }
  .site-sidebar { border-right: 0; border-bottom: 1px solid #d1d9e0; }
  .site-main { padding: 28px 22px; }
}
`

function renderFolderNavigation(
  folder: NotesFolderTreeRecord,
  notesByFolder: Map<number, NoteRecord[]>,
  hrefForNote: (note: NoteRecord) => string,
): string {
  const notes = notesByFolder.get(folder.id) ?? []
  const noteItems = notes
    .map(
      note =>
        `<li><a class="site-note" href="${escapeHtml(hrefForNote(note))}">${escapeHtml(note.name)}</a></li>`,
    )
    .join('')
  const childItems = folder.children
    .map(
      child =>
        `<li>${renderFolderNavigation(child, notesByFolder, hrefForNote)}</li>`,
    )
    .join('')

  return `<div class="site-folder">${escapeHtml(folder.name)}</div><ul>${noteItems}${childItems}</ul>`
}

function encodePageHref(fileName: string): string {
  return encodeURIComponent(fileName)
}

function renderSitePage(options: {
  body: string
  breadcrumbs: string
  navigation: string
  title: string
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'">
  <title>${escapeHtml(options.title)}</title>
  <style>${SITE_STYLES}</style>
</head>
<body>
  <div class="site-layout">
    <aside class="site-sidebar"><nav class="site-nav">${options.navigation}</nav></aside>
    <main class="site-main">
      <div class="breadcrumbs">${options.breadcrumbs}</div>
      ${options.body}
    </main>
  </div>
</body>
</html>
`
}

function renderBreadcrumbs(
  note: NoteRecord,
  folderById: Map<number, NotesFolderTreeRecord>,
  rootId: number,
  rootName: string,
): string {
  const chain: NotesFolderTreeRecord[] = []
  let current = note.folder ? folderById.get(note.folder.id) : undefined
  while (current) {
    chain.unshift(current)
    if (current.id === rootId) {
      break
    }
    current
      = current.parentId === null ? undefined : folderById.get(current.parentId)
  }

  return [
    `<a href="../index.html">${escapeHtml(rootName)}</a>`,
    ...chain
      .filter(folder => folder.id !== rootId)
      .map(folder => escapeHtml(folder.name)),
    escapeHtml(note.name),
  ].join(' / ')
}

async function writeSite(
  stagingPath: string,
  scope: FolderSiteScope,
  allActiveNotes: NoteRecord[],
  previews: NoteExportDrawingPreview[],
): Promise<void> {
  const notesPath = join(stagingPath, 'notes')
  const imagesPath = join(stagingPath, 'assets', 'images')
  const drawingsPath = join(stagingPath, 'assets', 'drawings')
  await Promise.all([
    mkdir(notesPath, { recursive: true }),
    mkdir(imagesPath, { recursive: true }),
    mkdir(drawingsPath, { recursive: true }),
  ])

  const pageByNoteId = new Map(
    scope.notes.map(note => [note.id, pageFileName(note)]),
  )
  const notesByFolder = new Map<number, NoteRecord[]>()
  scope.notes.forEach((note) => {
    if (!note.folder) {
      return
    }
    const siblings = notesByFolder.get(note.folder.id) ?? []
    siblings.push(note)
    notesByFolder.set(note.folder.id, siblings)
  })

  const navigationFromIndex = renderFolderNavigation(
    scope.folder,
    notesByFolder,
    note => `notes/${encodePageHref(pageByNoteId.get(note.id)!)}`,
  )
  const navigationFromNote = renderFolderNavigation(
    scope.folder,
    notesByFolder,
    note => encodePageHref(pageByNoteId.get(note.id)!),
  )

  const drawingIdSet = new Set(getScopeDrawingIds(scope))
  const previewById = new Map(
    previews
      .filter(preview => isSafeDrawingSvg(preview.svg))
      .map(preview => [preview.id, preview]),
  )
  for (const drawingId of drawingIdSet) {
    if (!previewById.has(drawingId)) {
      throw new Error(`Drawing preview is unavailable: ${drawingId}`)
    }
  }

  const drawingSourceById = new Map<string, string>()
  await Promise.all(
    [...drawingIdSet].map(async (drawingId) => {
      const preview = previewById.get(drawingId)!
      const fileName = `${createHash('sha256')
        .update(drawingId)
        .digest('hex')
        .slice(0, 20)}.svg`
      await writeFile(join(drawingsPath, fileName), preview.svg, 'utf8')
      drawingSourceById.set(drawingId, `../assets/drawings/${fileName}`)
    }),
  )

  const notesStorage = useNotesStorage()
  const snippetsStorage = useStorage()
  const httpStorage = useHttpStorage()
  const allFolders = notesStorage.folders.getFolders()
  const httpFolders = httpStorage.folders.getFolders()
  const folderPathById = buildNoteFolderPathMap(allFolders)
  const httpFolderPathById = buildNoteFolderPathMap(httpFolders)
  const resolver = createInternalLinkResolver([
    ...snippetsStorage.snippets
      .getSnippets({ isDeleted: 0 })
      .map(snippet => ({
        id: snippet.id,
        name: snippet.name,
        type: 'snippet' as const,
      })),
    ...allActiveNotes.map(note => ({
      folderPath: note.folder ? folderPathById.get(note.folder.id) : undefined,
      id: note.id,
      name: note.name,
      type: 'note' as const,
    })),
    ...httpStorage.requests.getRequests().map(request => ({
      folderPath:
        request.folderId === null
          ? ''
          : (httpFolderPathById.get(request.folderId) ?? ''),
      id: request.id,
      name: request.name,
      type: 'http-request' as const,
    })),
  ])
  const assetSourceByName = new Map<string, string>()
  const paths = getNotesPaths(getVaultPath())

  const folderById = new Map(
    scope.folders.map(folder => [folder.id, folder]),
  )
  for (const note of scope.notes) {
    const linkerFolderPath = note.folder
      ? folderPathById.get(note.folder.id)
      : undefined
    const body = await renderNoteHtmlBody(note.content, {
      assetSource: async (fileName, response) => {
        const existing = assetSourceByName.get(fileName)
        if (existing) {
          return existing
        }
        if (response.status === 503) {
          throw new NotesAssetTemporarilyUnavailableError()
        }
        const mimeType = response.headers.get('content-type')
        if (!response.ok || !mimeType?.startsWith('image/')) {
          return null
        }
        const data = Buffer.from(await response.arrayBuffer())
        if (mimeType === 'image/svg+xml') {
          if (!isSafeDrawingSvg(data.toString('utf8'))) {
            return null
          }
          const source = `data:image/svg+xml;base64,${data.toString('base64')}`
          assetSourceByName.set(fileName, source)
          return source
        }

        const extension = extname(fileName).replace(/[^.a-z0-9]/gi, '')
        const outputName = `${createHash('sha256')
          .update(fileName)
          .digest('hex')
          .slice(0, 20)}${extension}`
        await writeFile(join(imagesPath, outputName), data)
        const source = `../assets/images/${outputName}`
        assetSourceByName.set(fileName, source)
        return source
      },
      drawingPreviews: previews,
      drawingSource: id => drawingSourceById.get(id) ?? null,
      internalLinkHref: (target) => {
        const legacyMatch = target.match(/^note:(\d+)$/)
        const resolved = legacyMatch
          ? { id: Number(legacyMatch[1]), type: 'note' as const }
          : resolver.resolve(target, { linkerFolderPath })
        if (!resolved || resolved.type !== 'note') {
          return null
        }
        const fileName = pageByNoteId.get(resolved.id)
        return fileName ? encodePageHref(fileName) : null
      },
      resolveAsset: fileName => resolveNotesAsset(fileName, paths),
      strictAssets: true,
    })
    if (/\bsrc="masscode:\/\/(?:notes-asset|drawing)\//.test(body)) {
      throw new Error(`Unresolved portable asset in note ${note.id}`)
    }
    const html = renderSitePage({
      body: `<article><h1>${escapeHtml(note.name)}</h1>${body}</article>`,
      breadcrumbs: renderBreadcrumbs(
        note,
        folderById,
        scope.folder.id,
        scope.folder.name,
      ),
      navigation: navigationFromNote,
      title: `${note.name} — ${scope.folder.name}`,
    })
    await writeFile(join(notesPath, pageByNoteId.get(note.id)!), html, 'utf8')
  }

  const firstNote = scope.notes[0]
  const indexBody = firstNote
    ? `<h1>${escapeHtml(scope.folder.name)}</h1><p><a href="notes/${escapeHtml(
      encodePageHref(pageByNoteId.get(firstNote.id)!),
    )}">${escapeHtml(firstNote.name)}</a></p>`
    : `<h1>${escapeHtml(scope.folder.name)}</h1>`
  await writeFile(
    join(stagingPath, 'index.html'),
    renderSitePage({
      body: indexBody,
      breadcrumbs: escapeHtml(scope.folder.name),
      navigation: navigationFromIndex,
      title: scope.folder.name,
    }),
    'utf8',
  )
}

export async function exportNoteFolderSite(
  payload: NoteFolderSiteExportPayload,
): Promise<NoteFolderSiteExportResponse> {
  const scope = loadScope(payload.folderId, payload.sort, payload.order)
  if (!scope) {
    throw new Error('Notes folder not found')
  }
  const drawingIds = getScopeDrawingIds(scope)
  if (drawingIds.length > MAX_DRAWING_PREVIEWS) {
    throw new Error(
      `Notes folder site export supports up to ${MAX_DRAWING_PREVIEWS} drawings`,
    )
  }
  if (
    hasUnavailableNotes(scope)
    || getScopeContentAvailability(scope) === 'cloud-unavailable'
    || hasUnavailableDrawings(drawingIds)
  ) {
    return { canceled: false, status: 'cloud-unavailable' }
  }

  const allActiveNotes = useNotesStorage().notes.getNotes({
    isDeleted: 0,
    withContent: false,
  })
  const parentPath = await chooseParentDirectory(scope.folder.name)
  if (!parentPath) {
    return { canceled: true, status: 'canceled' }
  }

  const destinationPath = await getAvailableDestination(
    parentPath,
    scope.folder.name,
  )
  const stagingPath = join(
    parentPath,
    `.masscode-site-${randomBytes(8).toString('hex')}`,
  )

  try {
    await mkdir(stagingPath)
    await writeSite(
      stagingPath,
      scope,
      allActiveNotes,
      payload.drawingPreviews,
    )
    await rename(stagingPath, destinationPath)
    return {
      canceled: false,
      directoryPath: destinationPath,
      status: 'exported',
    }
  }
  catch (error) {
    if (error instanceof NotesAssetTemporarilyUnavailableError) {
      return { canceled: false, status: 'cloud-unavailable' }
    }
    throw error
  }
  finally {
    await rm(stagingPath, { force: true, recursive: true })
  }
}
