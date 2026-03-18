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
import {
  buildFolderPathMap as buildFolderPathMapShared,
  buildPathToFolderIdMap as buildPathToFolderIdMapShared,
  getFolderSiblings as getFolderSiblingsShared,
  getNextFolderOrder as getNextFolderOrderShared,
} from './shared/folderIndex'

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
  return buildFolderPathMapShared(state.folders)
}

export function buildPathToFolderIdMap(
  state: MarkdownState,
): Map<string, number> {
  return buildPathToFolderIdMapShared(state.folders)
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
  return getFolderSiblingsShared(state.folders, parentId, excludeId)
}

export function getNextFolderOrder(
  state: MarkdownState,
  parentId: number | null,
): number {
  return getNextFolderOrderShared(state.folders, parentId)
}
