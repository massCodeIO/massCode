import path from 'node:path'
import fs from 'fs-extra'
import {
  DRAWINGS_SPACE_ID,
  INVALID_NAME_CHARS_RE,
  WINDOWS_RESERVED_NAME_RE,
} from '../runtime/constants'
import { ensureSpaceDirectory, getSpaceDirPath } from '../runtime/spaces'

export const DRAWING_FILE_EXTENSION = '.excalidraw'

const DEFAULT_DRAWING_NAME = 'Untitled'

export interface DrawingRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
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

function toDrawingRecord(filePath: string): DrawingRecord | null {
  try {
    const stat = fs.statSync(filePath)
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

function getUniqueDrawingName(
  vaultPath: string,
  baseName: string,
  excludeId?: string,
): string {
  let candidate = baseName
  let index = 2

  while (
    candidate !== excludeId
    && fs.pathExistsSync(getDrawingFilePath(vaultPath, candidate))
  ) {
    candidate = `${baseName} ${index}`
    index += 1
  }

  return candidate
}

export function listDrawings(vaultPath: string): DrawingRecord[] {
  const dirPath = ensureSpaceDirectory(vaultPath, DRAWINGS_SPACE_ID)

  return fs
    .readdirSync(dirPath)
    .filter(fileName => fileName.endsWith(DRAWING_FILE_EXTENSION))
    .filter(fileName => !fileName.startsWith('.'))
    .map(fileName => toDrawingRecord(path.join(dirPath, fileName)))
    .filter((record): record is DrawingRecord => record !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function readDrawing(vaultPath: string, id: string): string | null {
  const filePath = getDrawingFilePath(vaultPath, id)

  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath, 'utf8')
}

export function writeDrawing(
  vaultPath: string,
  id: string,
  content: string,
): DrawingRecord | null {
  ensureSpaceDirectory(vaultPath, DRAWINGS_SPACE_ID)
  const filePath = getDrawingFilePath(vaultPath, id)
  fs.writeFileSync(filePath, content, 'utf8')

  return toDrawingRecord(filePath)
}

export function createDrawing(
  vaultPath: string,
  name?: string | null,
): DrawingRecord {
  ensureSpaceDirectory(vaultPath, DRAWINGS_SPACE_ID)

  const baseName = sanitizeDrawingName(name ?? DEFAULT_DRAWING_NAME)
  const uniqueName = getUniqueDrawingName(vaultPath, baseName)
  const filePath = getDrawingFilePath(vaultPath, uniqueName)

  fs.writeFileSync(filePath, createEmptyDrawingContent(), 'utf8')

  return toDrawingRecord(filePath)!
}

export function renameDrawing(
  vaultPath: string,
  id: string,
  name: string,
): DrawingRecord | null {
  const sourcePath = getDrawingFilePath(vaultPath, id)

  if (!fs.pathExistsSync(sourcePath)) {
    return null
  }

  const baseName = sanitizeDrawingName(name)
  const uniqueName = getUniqueDrawingName(vaultPath, baseName, id)

  if (uniqueName === id) {
    return toDrawingRecord(sourcePath)
  }

  const targetPath = getDrawingFilePath(vaultPath, uniqueName)
  fs.moveSync(sourcePath, targetPath)

  return toDrawingRecord(targetPath)
}

export function duplicateDrawing(
  vaultPath: string,
  id: string,
): DrawingRecord | null {
  const sourcePath = getDrawingFilePath(vaultPath, id)

  if (!fs.pathExistsSync(sourcePath)) {
    return null
  }

  const uniqueName = getUniqueDrawingName(vaultPath, id)
  const targetPath = getDrawingFilePath(vaultPath, uniqueName)
  fs.copySync(sourcePath, targetPath)

  return toDrawingRecord(targetPath)
}

export function deleteDrawing(
  vaultPath: string,
  id: string,
): { deleted: boolean } {
  const filePath = getDrawingFilePath(vaultPath, id)

  if (!fs.pathExistsSync(filePath)) {
    return { deleted: false }
  }

  fs.removeSync(filePath)

  return { deleted: true }
}
