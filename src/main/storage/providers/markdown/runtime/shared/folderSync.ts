import type { FolderDiskEntry, FolderMetadataSyncSource } from './folderTypes'
import path from 'node:path'
import {
  normalizeFlag,
  normalizeNumber,
  normalizePositiveInteger,
} from '../normalizers'
import { throwCloudContentUnavailable } from './cloudGuards'
import { buildFolderPathMap, normalizeFolderOrderIndices } from './folderIndex'
import { listUserFoldersFromDisk } from './folderScan'
import { depthOfRelativePath, normalizeDirectoryPath } from './path'

export type { FolderDiskEntry, FolderMetadataSyncSource } from './folderTypes'

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
  // Персистируемый fallback path → id (см. syncFolderIdByPathWithFolders):
  // после холодного старта state.folders пуст, и без него недокачанный
  // .meta.yaml приводил бы к чеканке нового id для существующей папки.
  folderIdByPath?: Record<string, number>
  folderUi: Record<string, { isOpen?: unknown }>
  folders: TFolder[]
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

  // Путь → id: живые folders приоритетнее персистированного fallback'а
  // (он нужен после холодного старта, когда state.folders ещё пуст, а
  // .meta.yaml каталога может быть недокачан).
  const oldFolderIdByPath = new Map<string, number>(
    Object.entries(state.folderIdByPath ?? {}),
  )
  const oldFolderPathMap = buildFolderPathMap(state.folders)
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
      // Метаданные папки существуют, но недокачаны из облака (первый запуск
      // после обновления: в state ещё нет folderIdByPath): чеканка нового id
      // осиротила бы все записи со старым folderId, а после докачки id
      // сменился бы ещё раз. Сверка прерывается cloud-ошибкой — reconciler
      // ретраит её до доступности метаданных (файл уже в очереди докачки).
      if (metadata.unavailable) {
        throwCloudContentUnavailable()
      }

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

  // Свежая карта path → id уходит в state как fallback для следующего
  // холодного старта.
  const nextFolderIdByPath: Record<string, number> = {}
  pathToFolderId.forEach((folderId, folderPath) => {
    nextFolderIdByPath[folderPath] = folderId
  })
  state.folderIdByPath = nextFolderIdByPath
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
}): FolderDiskEntry<TMetadata>[] {
  const diskFolders = listUserFoldersFromDisk({
    readMetadata: input.readMetadata,
    rootPath: input.rootPath,
    shouldSkipDirectory: input.shouldSkipDirectory,
  })

  syncFoldersStateFromDisk(input.state, diskFolders, input.buildFolder)

  return diskFolders
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
