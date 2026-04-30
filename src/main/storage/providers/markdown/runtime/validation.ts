import type { MarkdownErrorCode, Paths } from './types'
import path from 'node:path'
import fs from 'fs-extra'
import {
  INVALID_NAME_CHARS,
  META_DIR_NAME,
  RESERVED_ROOT_NAMES,
  WINDOWS_RESERVED_NAME_RE,
} from './constants'
import { normalizeErrorMessage } from './normalizers'
import { getFolderSiblings } from './shared/folderIndex'

export function throwStorageError(
  code: MarkdownErrorCode,
  message: string,
): never {
  throw new Error(`${code}:${message}`)
}

export function getMarkdownStorageErrorMessage(error: unknown): string {
  return normalizeErrorMessage(error)
}

function normalizeName(name: string): string {
  return name.trim()
}

function hasInvalidNameChars(name: string): boolean {
  for (const char of name) {
    if (INVALID_NAME_CHARS.has(char)) {
      return true
    }

    if (char.charCodeAt(0) <= 0x1F) {
      return true
    }
  }

  return false
}

export function validateEntryName(
  name: string,
  kind: 'folder' | 'note' | 'snippet' | 'request',
): string {
  const normalized = normalizeName(name)

  if (!normalized || normalized === '.' || normalized === '..') {
    throwStorageError('INVALID_NAME', `${kind} name is empty or invalid`)
  }

  if (normalized.startsWith('.')) {
    throwStorageError('INVALID_NAME', `${kind} name cannot start with a dot`)
  }

  if (hasInvalidNameChars(normalized)) {
    throwStorageError(
      'INVALID_NAME',
      `${kind} name contains invalid characters`,
    )
  }

  if (normalized.endsWith('.') || normalized.endsWith(' ')) {
    throwStorageError(
      'INVALID_NAME',
      `${kind} name cannot end with a space or dot`,
    )
  }

  if (WINDOWS_RESERVED_NAME_RE.test(normalized)) {
    throwStorageError('INVALID_NAME', `${kind} name is reserved on Windows`)
  }

  return normalized
}

export function toSnippetFileName(name: string): string {
  const normalized = validateEntryName(name, 'snippet')

  if (normalized.toLowerCase().endsWith('.md')) {
    return normalized
  }

  return `${normalized}.md`
}

export function assertNotReservedRootFolderName(
  parentId: number | null,
  name: string,
): void {
  const normalizedName = name.toLowerCase()

  if (normalizedName === META_DIR_NAME) {
    throwStorageError('RESERVED_NAME', 'This folder name is reserved')
  }

  if (parentId === null && RESERVED_ROOT_NAMES.has(normalizedName)) {
    throwStorageError(
      'RESERVED_NAME',
      'This folder name is reserved for technical folder',
    )
  }
}

export function assertUniqueSiblingEntryName(
  entries: {
    id: number
    name: string
    isDeleted?: number
    folderId: number | null
  }[],
  folderId: number | null,
  name: string,
  kind: 'note' | 'snippet' | 'request',
  excludeId?: number,
): void {
  const normalizedName = name.toLowerCase()

  const hasConflict = entries.some(
    entry =>
      entry.id !== excludeId
      && (entry.isDeleted ?? 0) === 0
      && entry.folderId === folderId
      && entry.name.toLowerCase() === normalizedName,
  )

  if (hasConflict) {
    const label
      = kind === 'note' ? 'Note' : kind === 'snippet' ? 'Snippet' : 'Request'
    throwStorageError(
      'NAME_CONFLICT',
      `${label} with this name already exists in this folder`,
    )
  }
}

export function assertUniqueSiblingFolderName(
  state: {
    folders: {
      id: number
      name: string
      orderIndex: number
      parentId: number | null
    }[]
  },
  parentId: number | null,
  name: string,
  excludeId?: number,
): void {
  const normalizedName = name.toLowerCase()

  const hasConflict = getFolderSiblings(
    state.folders,
    parentId,
    excludeId,
  ).some(folder => folder.name.toLowerCase() === normalizedName)

  if (hasConflict) {
    throwStorageError(
      'NAME_CONFLICT',
      'Folder with this name already exists on this level',
    )
  }
}

export function resolveUniqueSiblingFolderName(
  state: {
    folders: {
      id: number
      name: string
      orderIndex: number
      parentId: number | null
    }[]
  },
  parentId: number | null,
  name: string,
  excludeId?: number,
): string {
  const siblings = getFolderSiblings(state.folders, parentId, excludeId)
  const siblingNames = new Set(
    siblings.map(folder => folder.name.toLowerCase()),
  )

  if (!siblingNames.has(name.toLowerCase())) {
    return name
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidateName = `${name} ${suffix}`

    if (!siblingNames.has(candidateName.toLowerCase())) {
      return candidateName
    }
  }

  throwStorageError(
    'NAME_CONFLICT',
    'Cannot generate unique folder name on this level',
  )
}

export function assertDirectoryNameAvailable(
  paths: Paths,
  parentRelativePath: string,
  folderName: string,
  excludeRelativePath?: string,
): void {
  assertDirectoryNameAvailableAtRoot(
    paths.vaultPath,
    parentRelativePath,
    folderName,
    excludeRelativePath,
  )
}

export function assertDirectoryNameAvailableAtRoot(
  rootPath: string,
  parentRelativePath: string,
  folderName: string,
  excludeRelativePath?: string,
): void {
  const parentAbsolutePath = parentRelativePath
    ? path.join(rootPath, parentRelativePath)
    : rootPath
  fs.ensureDirSync(parentAbsolutePath)

  const excludeAbsolutePath = excludeRelativePath
    ? path.join(rootPath, excludeRelativePath)
    : null

  const entries = fs.readdirSync(parentAbsolutePath)
  const normalizedFolderName = folderName.toLowerCase()

  for (const entry of entries) {
    const entryAbsolutePath = path.join(parentAbsolutePath, entry)

    if (excludeAbsolutePath && entryAbsolutePath === excludeAbsolutePath) {
      continue
    }

    if (entry.toLowerCase() === normalizedFolderName) {
      throwStorageError(
        'NAME_CONFLICT',
        'Folder with this name already exists on this level',
      )
    }
  }
}
