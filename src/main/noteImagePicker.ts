import type { BrowserWindow } from 'electron'
import type { NoteImagePickerResult } from './types/ipc'
import { extname } from 'node:path'
import { clipboard, dialog } from 'electron'
import { lstat, readFile } from 'fs-extra'
import { z } from 'zod'
import {
  getNotesPaths,
  writeNotesAsset,
} from './storage/providers/markdown/notes/runtime'
import { getVaultPath } from './storage/providers/markdown/runtime'
import { ensureFlatSpacesLayout } from './storage/providers/markdown/runtime/spaces'

export function writeCapturedNoteImage(
  vault: unknown,
  buffer: ArrayBuffer,
  ext: string,
) {
  if (typeof vault !== 'string' || getVaultPath() !== vault)
    throw new Error('Stale Notes asset vault')
  ensureFlatSpacesLayout(vault)
  return writeNotesAsset(getNotesPaths(vault), buffer, ext)
}

const inputSchema = z
  .object({
    vault: z.string().max(8192),
    source: z.enum(['picker', 'clipboardImage']).optional(),
  })
  .strict()
export async function pickNoteImage(
  input: unknown,
  parent?: BrowserWindow,
): Promise<NoteImagePickerResult> {
  const { vault, source } = inputSchema.parse(input)
  if (getVaultPath() !== vault)
    return { status: 'stale' }
  if (source === 'clipboardImage') {
    try {
      const image = clipboard.readImage()
      if (image.isEmpty())
        return { status: 'failed' }
      const bytes = image.toPNG()
      if (!bytes.length || bytes.length > 10 * 1024 * 1024)
        return { status: 'failed' }
      const payload = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer
      const url = await writeCapturedNoteImage(vault, payload, '.png')
      return getVaultPath() === vault
        ? { status: 'saved', url, bytes: bytes.length }
        : { status: 'stale' }
    }
    catch {
      return { status: 'failed' }
    }
  }
  const options = {
    properties: ['openFile'] as ['openFile'],
    filters: [{ name: 'PNG / JPEG', extensions: ['png', 'jpg', 'jpeg'] }],
  }
  const selected = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  if (selected.canceled || selected.filePaths.length !== 1)
    return { status: 'cancelled' }
  if (getVaultPath() !== vault)
    return { status: 'stale' }
  try {
    const path = selected.filePaths[0]
    const stat = await lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 10 * 1024 * 1024)
      return { status: 'failed' }
    const bytes = await readFile(path)
    if (bytes.length > 10 * 1024 * 1024)
      return { status: 'failed' }
    if (getVaultPath() !== vault)
      return { status: 'stale' }
    const payload = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer
    const url = await writeCapturedNoteImage(vault, payload, extname(path))
    return getVaultPath() === vault
      ? { status: 'saved', url, bytes: bytes.length }
      : { status: 'stale' }
  }
  catch {
    return { status: 'failed' }
  }
}
