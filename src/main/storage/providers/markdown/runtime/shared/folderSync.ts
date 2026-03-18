import path from 'node:path'
import {
  normalizeFlag,
  normalizeFolderOrderIndices,
  normalizeNumber,
  normalizePositiveInteger,
} from '../normalizers'
import { buildFolderPathMap } from './folderIndex'
import { listUserFoldersFromDisk } from './folderScan'
import { depthOfRelativePath, normalizeDirectoryPath } from './path'

export interface FolderMetadataSyncSource {
  createdAt?: unknown
  id?: unknown
  masscode_id?: unknown
  orderIndex?: unknown
  updatedAt?: unknown
}

export interface SyncFolderBase {
  createdAt: number
  id: number
  isOpen: number
  name: string
  orderIndex: number
  parentId: number | null
  updatedAt: number
}

export interface FolderSyncState<TFolder extends SyncFolderBase> {
  counters: {
    folderId: number
  }
  folderUi: Record<string, { isOpen?: unknown }>
  folders: TFolder[]
}

export interface FolderDiskEntry<TMetadata extends FolderMetadataSyncSource> {
  metadata: TMetadata
  path: string
}

export interface BuildSyncedFolderInput<
  TFolder extends SyncFolderBase,
  TMetadata extends FolderMetadataSyncSource,
> {
  base: SyncFolderBase
  folderPath: string
  metadata: TMetadata
  previousFolder: TFolder | undefined
}

export function syncFoldersStateFromDisk<
  TFolder extends SyncFolderBase,
  TMetadata extends FolderMetadataSyncSource,
>(
  state: FolderSyncState<TFolder>,
  diskFolders: FolderDiskEntry<TMetadata>[],
  buildFolder: (input: BuildSyncedFolderInput<TFolder, TMetadata>) => TFolder,
): void {
  const oldFoldersById = new Map<number, TFolder>(
    state.folders.map(folder => [folder.id, folder]),
  )
  const oldFolderPathMap = buildFolderPathMap(state.folders)
  const oldFolderIdByPath = new Map<string, number>()
  oldFolderPathMap.forEach((folderPath, folderId) => {
    oldFolderIdByPath.set(folderPath, folderId)
  })

  const orderedDiskFolders = [...diskFolders].sort((a, b) => {
    const depthA = depthOfRelativePath(a.path)
    const depthB = depthOfRelativePath(b.path)

    if (depthA !== depthB) {
      return depthA - depthB
    }

    return a.path.localeCompare(b.path)
  })

  const pathToFolderId = new Map<string, number>()
  const usedFolderIds = new Set<number>()
  const nextFolders: TFolder[] = []
  let nextFolderId = Math.max(
    state.counters.folderId,
    ...state.folders.map(folder => folder.id),
  )

  for (const diskFolder of orderedDiskFolders) {
    const { metadata } = diskFolder
    const folderPath = diskFolder.path
    const parentPath = normalizeDirectoryPath(path.posix.dirname(folderPath))
    const parentId = parentPath ? pathToFolderId.get(parentPath) || null : null

    const metadataFolderId = normalizePositiveInteger(
      metadata.id ?? metadata.masscode_id,
    )
    const pathFolderId = oldFolderIdByPath.get(folderPath) || null

    let folderId
      = metadataFolderId && !usedFolderIds.has(metadataFolderId)
        ? metadataFolderId
        : null

    if (!folderId && pathFolderId && !usedFolderIds.has(pathFolderId)) {
      folderId = pathFolderId
    }

    if (!folderId) {
      nextFolderId += 1
      folderId = nextFolderId
    }

    usedFolderIds.add(folderId)
    pathToFolderId.set(folderPath, folderId)

    const previousFolder = oldFoldersById.get(folderId)
    const previousFolderUi = state.folderUi[String(folderId)]
    const fallbackOrderIndex
      = nextFolders
        .filter(folder => folder.parentId === parentId)
        .reduce(
          (maxOrder, folder) => Math.max(maxOrder, folder.orderIndex),
          -1,
        ) + 1
    const now = Date.now()
    const createdAt = normalizeNumber(
      metadata.createdAt,
      previousFolder?.createdAt ?? now,
    )
    const base: SyncFolderBase = {
      createdAt,
      id: folderId,
      isOpen: normalizeFlag(
        previousFolderUi?.isOpen,
        previousFolder?.isOpen ?? 0,
      ),
      name: path.posix.basename(folderPath),
      orderIndex: Math.max(
        0,
        Math.trunc(
          normalizeNumber(
            metadata.orderIndex,
            previousFolder?.orderIndex ?? fallbackOrderIndex,
          ),
        ),
      ),
      parentId,
      updatedAt: normalizeNumber(
        metadata.updatedAt,
        previousFolder?.updatedAt ?? createdAt,
      ),
    }

    nextFolders.push(
      buildFolder({
        base,
        folderPath,
        metadata,
        previousFolder,
      }),
    )
  }

  normalizeFolderOrderIndices(nextFolders)
  state.folders = nextFolders
  state.counters.folderId = Math.max(state.counters.folderId, nextFolderId)
}

export function syncFoldersStateFromDiskAtRoot<
  TFolder extends SyncFolderBase,
  TMetadata extends FolderMetadataSyncSource,
>(input: {
  buildFolder: (input: BuildSyncedFolderInput<TFolder, TMetadata>) => TFolder
  readMetadata: (relativePath: string) => TMetadata
  rootPath: string
  shouldSkipDirectory?: (input: {
    entryName: string
    isRoot: boolean
    relativePath: string
  }) => boolean
  state: FolderSyncState<TFolder>
}): void {
  const diskFolders = listUserFoldersFromDisk({
    readMetadata: input.readMetadata,
    rootPath: input.rootPath,
    shouldSkipDirectory: input.shouldSkipDirectory,
  })

  syncFoldersStateFromDisk(input.state, diskFolders, input.buildFolder)
}

export function syncFolderMetadataFilesByPathMap<
  TFolder extends { id: number },
>(
  folders: TFolder[],
  folderPathMap: ReadonlyMap<number, string>,
  writeMetadata: (folderPath: string, folder: TFolder) => void,
): void {
  folders.forEach((folder) => {
    const folderPath = folderPathMap.get(folder.id)
    if (!folderPath) {
      return
    }

    writeMetadata(folderPath, folder)
  })
}
