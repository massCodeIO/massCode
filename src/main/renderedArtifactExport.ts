import type {
  RenderedArtifactExportPayload,
  RenderedArtifactExportResult,
} from './types/ipc'
import { Buffer } from 'node:buffer'
import { BrowserWindow, dialog } from 'electron'
import { sanitizeNoteExportFileName, writeFileAtomically } from './notesExport'
import { getVaultPath } from './storage/providers/markdown/runtime'

const MAX_BYTES = 50 * 1024 * 1024

export function parseRenderedArtifact(value: unknown): {
  payload: RenderedArtifactExportPayload
  bytes: Buffer
} {
  const payload = value as Partial<RenderedArtifactExportPayload> | null
  if (
    !payload
    || !['png', 'svg', 'html'].includes(payload.format ?? '')
    || typeof payload.name !== 'string'
    || payload.name.length > 1024
    || typeof payload.vault !== 'string'
    || typeof payload.data !== 'string'
    || payload.data.length > MAX_BYTES * 3
  ) {
    throw new TypeError('INVALID_ARTIFACT')
  }
  let bytes: Buffer
  if (payload.format === 'html') {
    bytes = Buffer.from(payload.data, 'utf8')
  }
  else if (payload.format === 'png') {
    const encoded = payload.data.match(
      /^data:image\/png;base64,([A-Z\d+/]*={0,2})$/i,
    )?.[1]
    if (!encoded)
      throw new TypeError('INVALID_ARTIFACT')
    bytes = Buffer.from(encoded, 'base64')
    if (
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      throw new TypeError('INVALID_ARTIFACT')
    }
  }
  else {
    const encoded = payload.data.match(
      /^data:image\/svg\+xml(?:;charset=utf-8)?,([\s\S]+)$/,
    )?.[1]
    if (!encoded)
      throw new TypeError('INVALID_ARTIFACT')
    // dom-to-image escapes only # and newlines, leaving e.g. width="100%".
    const svg = encoded.startsWith('<svg')
      ? encoded.replaceAll('%23', '#').replaceAll('%0A', '\n')
      : decodeURIComponent(encoded)
    if (!/^\s*<svg\b/i.test(svg))
      throw new TypeError('INVALID_ARTIFACT')
    bytes = Buffer.from(svg, 'utf8')
  }
  if (!bytes.length || bytes.length > MAX_BYTES)
    throw new TypeError('INVALID_ARTIFACT_SIZE')
  return { payload: payload as RenderedArtifactExportPayload, bytes }
}

export async function exportRenderedArtifact(
  value: unknown,
): Promise<RenderedArtifactExportResult> {
  const { payload, bytes } = parseRenderedArtifact(value)
  if (getVaultPath() !== payload.vault)
    return { status: 'stale' }
  const options = {
    defaultPath: `${sanitizeNoteExportFileName(payload.name, 'html').slice(0, -5)}.${payload.format}`,
    filters: [
      { name: payload.format.toUpperCase(), extensions: [payload.format] },
    ],
  }
  const parent = BrowserWindow.getFocusedWindow()
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath)
    return { status: 'cancelled' }
  if (getVaultPath() !== payload.vault)
    return { status: 'stale' }
  await writeFileAtomically(result.filePath, bytes)
  return { status: 'saved', filePath: result.filePath, bytes: bytes.length }
}
