import type { FolderRecord } from '../../../contracts'
import type { MarkdownState, Paths } from './types'
import path from 'node:path'
import { store } from '../../../../store'
import {
  INBOX_DIR_NAME,
  META_DIR_NAME,
  runtimeRef,
  TRASH_DIR_NAME,
} from './constants'

export function getVaultPath(): string {
  const configuredVaultPath = store.preferences.get('storage.vaultPath') as
    | string
    | null
    | undefined

  if (configuredVaultPath && configuredVaultPath.trim()) {
    return configuredVaultPath
  }

  const storagePath = store.preferences.get('storagePath') as string
  return path.join(storagePath, 'markdown-vault')
}

export function getPaths(vaultPath: string): Paths {
  const metaDirPath = path.join(vaultPath, META_DIR_NAME)

  return {
    inboxDirPath: path.join(metaDirPath, INBOX_DIR_NAME),
    metaDirPath,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, TRASH_DIR_NAME),
    vaultPath,
  }
}

export {
  depthOfRelativePath,
  normalizeDirectoryPath,
  toPosixPath,
} from './shared/path'

export function buildFolderPathMap(state: MarkdownState): Map<number, string> {
  const folderById = new Map<number, FolderRecord>()
  state.folders.forEach(folder => folderById.set(folder.id, folder))

  const resolvedMap = new Map<number, string>()
  const visiting = new Set<number>()

  const resolveFolderPath = (folderId: number): string => {
    const existingPath = resolvedMap.get(folderId)
    if (existingPath !== undefined) {
      return existingPath
    }

    const folder = folderById.get(folderId)
    if (!folder) {
      return ''
    }

    if (visiting.has(folderId)) {
      return folder.name
    }

    visiting.add(folderId)

    const parentPath
      = folder.parentId !== null ? resolveFolderPath(folder.parentId) : ''
    const currentPath = parentPath
      ? path.posix.join(parentPath, folder.name)
      : folder.name

    resolvedMap.set(folderId, currentPath)
    visiting.delete(folderId)

    return currentPath
  }

  state.folders.forEach(folder => resolveFolderPath(folder.id))

  return resolvedMap
}

export function buildPathToFolderIdMap(
  state: MarkdownState,
): Map<string, number> {
  const folderPathMap = buildFolderPathMap(state)
  const pathMap = new Map<string, number>()

  folderPathMap.forEach((folderPath, folderId) => {
    pathMap.set(folderPath, folderId)
  })

  return pathMap
}

export function findFolderById(
  state: MarkdownState,
  folderId: number,
): FolderRecord | undefined {
  const cache = runtimeRef.cache
  const runtimeCache = cache?.state === state ? cache : null

  if (runtimeCache) {
    if (runtimeCache.folderById.size !== state.folders.length) {
      runtimeCache.folderById = new Map(
        state.folders.map(folder => [folder.id, folder]),
      )
    }

    const folderFromIndex = runtimeCache.folderById.get(folderId)
    if (folderFromIndex) {
      return folderFromIndex
    }
  }

  const folder = state.folders.find(item => item.id === folderId)
  if (folder && runtimeCache) {
    runtimeCache.folderById.set(folderId, folder)
  }

  return folder
}

export function getFolderPathById(
  state: MarkdownState,
  folderId: number,
): string | null {
  const folderPathMap = buildFolderPathMap(state)
  return folderPathMap.get(folderId) || null
}

export function getFolderSiblings(
  state: MarkdownState,
  parentId: number | null,
  excludeId?: number,
): FolderRecord[] {
  return state.folders.filter((folder) => {
    if (folder.parentId !== parentId) {
      return false
    }

    if (excludeId !== undefined && folder.id === excludeId) {
      return false
    }

    return true
  })
}

export function getNextFolderOrder(
  state: MarkdownState,
  parentId: number | null,
): number {
  return (
    state.folders
      .filter(folder => folder.parentId === parentId)
      .reduce((maxOrder, folder) => Math.max(maxOrder, folder.orderIndex), -1)
      + 1
  )
}
