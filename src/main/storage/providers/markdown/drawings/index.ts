import path from 'node:path'
import fs from 'fs-extra'
import {
  enqueueCloudDownload,
  prioritizeCloudDownload,
} from '../cloudDownloads'
import {
  DRAWINGS_SPACE_ID,
  INVALID_NAME_CHARS_RE,
  WINDOWS_RESERVED_NAME_RE,
} from '../runtime/constants'
import { getFileAvailability } from '../runtime/shared/cloudFiles'
import { ensureSpaceDirectory, getSpaceDirPath } from '../runtime/spaces'

export const DRAWING_FILE_EXTENSION = '.excalidraw'

const DEFAULT_DRAWING_NAME = 'Untitled'

// Own mutations are remembered briefly so the vault watcher can skip
// broadcasting echoes of the app's own writes back to the renderer.
const RECENT_APP_CHANGE_TTL_MS = 2500
const recentAppChanges = new Map<string, number>()

export interface DrawingRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

function rememberAppChange(filePath: string): void {
  const now = Date.now()

  for (const [knownPath, timestamp] of recentAppChanges) {
    if (now - timestamp > RECENT_APP_CHANGE_TTL_MS) {
      recentAppChanges.delete(knownPath)
    }
  }

  recentAppChanges.set(path.resolve(filePath), now)
}

export function wasRecentAppDrawingChange(
  vaultPath: string,
  relativePath: string,
): boolean {
  const absolutePath = path.resolve(path.join(vaultPath, relativePath))
  const timestamp = recentAppChanges.get(absolutePath)

  if (timestamp === undefined) {
    return false
  }

  return Date.now() - timestamp <= RECENT_APP_CHANGE_TTL_MS
}

export function createEmptyDrawingContent(): string {
  return `${JSON.stringify(
    {
      type: 'excalidraw',
      version: 2,
      source: 'massCode',
      elements: [],
      appState: {
        gridSize: null,
        viewBackgroundColor: '#ffffff',
      },
      files: {},
    },
    null,
    2,
  )}\n`
}

function removeControlChars(value: string): string {
  return [...value].filter(char => char.charCodeAt(0) > 0x1F).join('')
}

export function sanitizeDrawingName(name: string | null | undefined): string {
  let candidate = typeof name === 'string' ? name.trim() : ''

  candidate = removeControlChars(candidate)
  candidate = candidate.replace(INVALID_NAME_CHARS_RE, ' ')
  candidate = candidate.replace(/\s+/g, ' ').trim()
  candidate = candidate.replace(/[. ]+$/g, '').trim()

  if (!candidate || candidate === '.' || candidate === '..') {
    candidate = DEFAULT_DRAWING_NAME
  }

  if (WINDOWS_RESERVED_NAME_RE.test(candidate)) {
    candidate = `${candidate} 1`
  }

  return candidate
}

function getDrawingsDirPath(vaultPath: string): string {
  return getSpaceDirPath(vaultPath, DRAWINGS_SPACE_ID)
}

function getDrawingFilePath(vaultPath: string, id: string): string {
  const dirPath = getDrawingsDirPath(vaultPath)
  const filePath = path.join(dirPath, `${id}${DRAWING_FILE_EXTENSION}`)

  if (path.dirname(filePath) !== dirPath) {
    throw new Error(`INVALID_NAME: invalid drawing id "${id}"`)
  }

  return filePath
}

async function toDrawingRecord(
  filePath: string,
): Promise<DrawingRecord | null> {
  try {
    const stat = await fs.stat(filePath)
    const name = path.basename(filePath, DRAWING_FILE_EXTENSION)

    return {
      id: name,
      name,
      createdAt: stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs,
      updatedAt: stat.mtimeMs,
    }
  }
  catch {
    return null
  }
}

async function getUniqueDrawingName(
  vaultPath: string,
  baseName: string,
  excludeId?: string,
): Promise<string> {
  const normalizedExcludeId = excludeId?.toLowerCase()
  let candidate = baseName
  let index = 2

  // The comparison with excludeId is case-insensitive: on macOS and
  // Windows the filesystem is, and a case-only rename must not collide
  // with the file itself.
  while (
    candidate.toLowerCase() !== normalizedExcludeId
    && (await fs.pathExists(getDrawingFilePath(vaultPath, candidate)))
  ) {
    candidate = `${baseName} ${index}`
    index += 1
  }

  return candidate
}

export async function listDrawings(
  vaultPath: string,
): Promise<DrawingRecord[]> {
  const dirPath = ensureSpaceDirectory(vaultPath, DRAWINGS_SPACE_ID)
  const entries = await fs.readdir(dirPath, { withFileTypes: true })

  const records = await Promise.all(
    entries
      .filter(entry => entry.isFile())
      .filter(entry => entry.name.endsWith(DRAWING_FILE_EXTENSION))
      .filter(entry => !entry.name.startsWith('.'))
      .map(entry => toDrawingRecord(path.join(dirPath, entry.name))),
  )

  return records
    .filter((record): record is DrawingRecord => record !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function readDrawing(
  vaultPath: string,
  id: string,
): Promise<string | null> {
  const filePath = getDrawingFilePath(vaultPath, id)

  // Недокачанный рисунок не читается: чтение зависло бы в UV threadpool до
  // докачки. Файл поднимается в приоритет очереди, после докачки renderer
  // получит событие sync и перечитает рисунок.
  if (getFileAvailability(filePath).isCloudPlaceholder) {
    prioritizeCloudDownload(filePath)
    return null
  }

  try {
    return await fs.readFile(filePath, 'utf8')
  }
  catch {
    return null
  }
}

export async function writeDrawing(
  vaultPath: string,
  id: string,
  content: string,
): Promise<{ updatedAt: number }> {
  ensureSpaceDirectory(vaultPath, DRAWINGS_SPACE_ID)
  const filePath = getDrawingFilePath(vaultPath, id)

  // Запись в недокачанный рисунок затёрла бы облачное содержимое.
  if (getFileAvailability(filePath).isCloudPlaceholder) {
    enqueueCloudDownload(filePath)
    throw new Error(
      'CLOUD_FILE_NOT_DOWNLOADED:This drawing is still downloading from cloud storage. Try again once the download completes.',
    )
  }

  rememberAppChange(filePath)
  await fs.writeFile(filePath, content, 'utf8')

  return { updatedAt: Date.now() }
}

export async function createDrawing(
  vaultPath: string,
  name?: string | null,
): Promise<DrawingRecord> {
  ensureSpaceDirectory(vaultPath, DRAWINGS_SPACE_ID)

  const baseName = sanitizeDrawingName(name ?? DEFAULT_DRAWING_NAME)
  const uniqueName = await getUniqueDrawingName(vaultPath, baseName)
  const filePath = getDrawingFilePath(vaultPath, uniqueName)

  rememberAppChange(filePath)
  await fs.writeFile(filePath, createEmptyDrawingContent(), 'utf8')

  return (await toDrawingRecord(filePath))!
}

export async function renameDrawing(
  vaultPath: string,
  id: string,
  name: string,
): Promise<DrawingRecord | null> {
  const sourcePath = getDrawingFilePath(vaultPath, id)

  if (!(await fs.pathExists(sourcePath))) {
    return null
  }

  const baseName = sanitizeDrawingName(name)
  const uniqueName = await getUniqueDrawingName(vaultPath, baseName, id)

  if (uniqueName === id) {
    return toDrawingRecord(sourcePath)
  }

  const targetPath = getDrawingFilePath(vaultPath, uniqueName)
  rememberAppChange(sourcePath)
  rememberAppChange(targetPath)

  if (uniqueName.toLowerCase() === id.toLowerCase()) {
    // Case-only rename: on case-insensitive filesystems fs.move treats
    // the target as an existing file, while a plain rename succeeds.
    await fs.rename(sourcePath, targetPath)
  }
  else {
    await fs.move(sourcePath, targetPath)
  }

  return toDrawingRecord(targetPath)
}

export async function duplicateDrawing(
  vaultPath: string,
  id: string,
): Promise<DrawingRecord | null> {
  const sourcePath = getDrawingFilePath(vaultPath, id)

  if (!(await fs.pathExists(sourcePath))) {
    return null
  }

  const uniqueName = await getUniqueDrawingName(vaultPath, id)
  const targetPath = getDrawingFilePath(vaultPath, uniqueName)
  rememberAppChange(targetPath)
  await fs.copy(sourcePath, targetPath)

  return toDrawingRecord(targetPath)
}

export async function deleteDrawing(
  vaultPath: string,
  id: string,
): Promise<{ deleted: boolean }> {
  const filePath = getDrawingFilePath(vaultPath, id)

  if (!(await fs.pathExists(filePath))) {
    return { deleted: false }
  }

  rememberAppChange(filePath)
  await fs.remove(filePath)

  return { deleted: true }
}
