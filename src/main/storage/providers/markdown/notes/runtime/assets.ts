import type { NotesPaths } from './types'
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { lstat, open, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import fs from 'fs-extra'
import { prioritizeCloudDownload } from '../../cloudDownloads'
import { getFileAvailability } from '../../runtime/shared/cloudFiles'

const ASSET_ID_LENGTHS = new Set([16, 21])
const READER_MIME_BY_EXTENSION: Record<string, string> = {
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}
const WRITER_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png'])
const SAFE_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export interface ParsedNotesAssetName {
  extension: string
  fileName: string
  mimeType: string
}

export interface NotesAssetWritePayload {
  buffer: ArrayBuffer
  ext: string
}

export function parseNotesAssetWritePayload(
  payload: unknown,
): NotesAssetWritePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as { buffer?: unknown, ext?: unknown }
  if (
    typeof candidate.ext !== 'string'
    || !(candidate.buffer instanceof ArrayBuffer)
  ) {
    return null
  }

  return { buffer: candidate.buffer, ext: candidate.ext }
}

function hasExpectedImageSignature(data: Buffer, extension: string): boolean {
  if (extension === '.png') {
    return data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    return (
      data.length >= 3
      && data[0] === 0xFF
      && data[1] === 0xD8
      && data[2] === 0xFF
    )
  }

  return false
}

export function parseNotesAssetName(
  value: string,
): ParsedNotesAssetName | null {
  let fileName: string
  try {
    fileName = decodeURIComponent(value)
  }
  catch {
    return null
  }

  if (
    fileName !== path.basename(fileName)
    || fileName.includes('/')
    || fileName.includes('\\')
    || fileName.includes('..')
  ) {
    return null
  }

  const extension = path.extname(fileName).toLowerCase()
  const stem = fileName.slice(0, -extension.length)
  const mimeType = READER_MIME_BY_EXTENSION[extension]

  if (
    !mimeType
    || !ASSET_ID_LENGTHS.has(stem.length)
    || !/^[\w-]+$/.test(stem)
  ) {
    return null
  }

  return { extension, fileName, mimeType }
}

export function getNotesAssetNameFromAbsolutePath(
  paths: NotesPaths,
  absolutePath: string,
): string | null {
  const parentPath = path.resolve(path.dirname(absolutePath))
  if (
    parentPath !== path.resolve(paths.assetsPath)
    && parentPath !== path.resolve(paths.legacyAssetsPath)
  ) {
    return null
  }

  return parseNotesAssetName(path.basename(absolutePath))?.fileName ?? null
}

export function normalizeNotesAssetWriterExtension(
  value: string,
): string | null {
  const extension = value.toLowerCase()
  return WRITER_EXTENSIONS.has(extension) ? extension : null
}

function generateAssetId(): string {
  return randomBytes(12).toString('base64url')
}

export async function writeNotesAsset(
  paths: NotesPaths,
  payload: ArrayBuffer,
  requestedExtension: string,
  generateId: () => string = generateAssetId,
): Promise<string> {
  const extension = normalizeNotesAssetWriterExtension(requestedExtension)
  if (!extension) {
    throw new Error('Unsupported Notes asset extension')
  }

  const data = Buffer.from(payload)
  if (!hasExpectedImageSignature(data, extension)) {
    throw new Error('Notes asset payload does not match its extension')
  }

  const fileName = `${generateId()}${extension}`
  const parsedName = parseNotesAssetName(fileName)
  if (!parsedName) {
    throw new Error('Invalid generated Notes asset name')
  }

  await fs.ensureDir(paths.assetsPath)
  const destinationPath = path.join(paths.assetsPath, parsedName.fileName)
  const destinationAvailability = getFileAvailability(destinationPath)
  if (destinationAvailability.exists) {
    throw new Error('Notes asset destination already exists')
  }

  const tempPath = path.join(
    paths.assetsPath,
    `.${parsedName.fileName}.${randomBytes(8).toString('hex')}.tmp`,
  )
  let tempCreated = false

  try {
    const handle = await open(
      tempPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    )
    tempCreated = true
    try {
      await handle.writeFile(data)
    }
    finally {
      await handle.close()
    }

    if (getFileAvailability(destinationPath).exists) {
      throw new Error('Notes asset destination already exists')
    }

    await rename(tempPath, destinationPath)
    tempCreated = false
    return `masscode://notes-asset/${parsedName.fileName}`
  }
  finally {
    if (tempCreated) {
      await rm(tempPath, { force: true })
    }
  }
}

function unavailableResponse(): Response {
  return new Response('Temporarily unavailable', {
    headers: {
      ...SAFE_RESPONSE_HEADERS,
      'Retry-After': '1',
    },
    status: 503,
  })
}

function notFoundResponse(): Response {
  return new Response('Not found', {
    headers: SAFE_RESPONSE_HEADERS,
    status: 404,
  })
}

export async function resolveNotesAsset(
  rawFileName: string,
  paths: NotesPaths,
  prioritizeDownload: (absolutePath: string) => void = prioritizeCloudDownload,
): Promise<Response> {
  const parsedName = parseNotesAssetName(rawFileName)
  if (!parsedName) {
    return notFoundResponse()
  }

  for (const rootPath of [paths.assetsPath, paths.legacyAssetsPath]) {
    const absolutePath = path.join(rootPath, parsedName.fileName)
    try {
      if ((await lstat(absolutePath)).isSymbolicLink()) {
        return notFoundResponse()
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      return notFoundResponse()
    }

    const availability = getFileAvailability(absolutePath)

    if (!availability.exists) {
      continue
    }

    if (!availability.stats?.isFile()) {
      return notFoundResponse()
    }

    if (availability.isCloudPlaceholder) {
      prioritizeDownload(absolutePath)
      return unavailableResponse()
    }

    try {
      const data = await readFile(absolutePath)
      const headers: Record<string, string> = {
        ...SAFE_RESPONSE_HEADERS,
        'Content-Type': parsedName.mimeType,
      }
      if (parsedName.extension === '.svg') {
        headers['Content-Security-Policy'] = 'default-src \'none\'; sandbox'
      }
      return new Response(data, { headers })
    }
    catch {
      return notFoundResponse()
    }
  }

  return notFoundResponse()
}
