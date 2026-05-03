import type {
  HttpFolderCreateInput,
  HttpFoldersStorage,
  HttpFolderUpdateInput,
  HttpFolderUpdateResult,
} from '../../../../contracts'
import type {
  HttpFolderRecord,
  HttpRequestIndexItem,
  HttpRequestRecord,
} from '../runtime/types'
import path from 'node:path'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
import {
  buildFolderPathMap,
  collectDescendantIds,
  getNextFolderOrder,
} from '../../runtime/shared/folderIndex'
import {
  applyFolderParentAndOrder,
  assertFolderMoveTargetValid,
  createFolderInStateAndDisk,
  getFolderPathsByDepth,
  getFoldersSortedByCreatedAt,
  getFoldersTreeSorted,
  moveFolderDirectoryOnDisk,
  removeFolderPathsFromDisk,
  replaceSubtreePathPrefix,
  resolveFolderUpdateTargets,
  updateChildEntityPaths,
} from '../../runtime/shared/foldersStorage'
import {
  assertDirectoryNameAvailableAtRoot,
  assertUniqueSiblingFolderName,
  resolveUniqueSiblingFolderName,
  throwStorageError,
  validateEntryName,
} from '../../runtime/validation'
import { getHttpPaths } from '../runtime/paths'
import { saveHttpState } from '../runtime/state'
import { getHttpRuntimeCache } from '../runtime/sync'

function findHttpFolderById(
  folders: HttpFolderRecord[],
  folderId: number,
): HttpFolderRecord | undefined {
  return folders.find(folder => folder.id === folderId)
}

function syncRequestFolderId(
  records: HttpRequestRecord[],
  indexEntries: HttpRequestIndexItem[],
  pathToFolderId: Map<string, number>,
): void {
  for (const record of records) {
    const indexEntry = indexEntries.find(entry => entry.id === record.id)
    const filePath = indexEntry?.filePath ?? record.filePath
    const dirPath = path.posix.dirname(filePath)
    const nextFolderId
      = dirPath && dirPath !== '.' ? (pathToFolderId.get(dirPath) ?? null) : null
    record.folderId = nextFolderId
  }
}

export function createHttpFoldersStorage(): HttpFoldersStorage {
  function resolvePaths() {
    return getHttpPaths(getVaultPath())
  }

  function getCache() {
    return getHttpRuntimeCache(resolvePaths())
  }

  return {
    getFolders() {
      const { state } = getCache()
      return getFoldersSortedByCreatedAt(state.folders)
    },

    getFoldersTree() {
      const { state } = getCache()
      return getFoldersTreeSorted(state.folders)
    },

    createFolder(input: HttpFolderCreateInput) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      const name = validateEntryName(input.name, 'folder')
      const parentId = input.parentId ?? null

      assertUniqueSiblingFolderName(state, parentId, name)

      if (parentId !== null) {
        const parent = findHttpFolderById(state.folders, parentId)
        if (!parent) {
          throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
        }
      }

      const { id: folderId } = createFolderInStateAndDisk({
        buildFolderPathMap: state => buildFolderPathMap(state.folders),
        createFolder: ({ id, name, now, orderIndex, parentId }) => ({
          createdAt: now,
          id,
          icon: input.icon ?? null,
          isOpen: 0,
          name,
          orderIndex,
          parentId,
          updatedAt: now,
        }),
        getNextFolderOrder: (state, parentId) =>
          getNextFolderOrder(state.folders, parentId),
        name,
        parentId,
        rootPath: paths.httpRoot,
        state,
      })
      saveHttpState(paths, state)

      return { id: folderId }
    },

    updateFolder(
      id: number,
      input: HttpFolderUpdateInput,
    ): HttpFolderUpdateResult {
      const paths = resolvePaths()
      const cache = getHttpRuntimeCache(paths)
      const { state } = cache
      const folder = findHttpFolderById(state.folders, id)

      if (!folder) {
        return { invalidInput: false, notFound: true }
      }

      if (
        input.name === undefined
        && input.icon === undefined
        && input.parentId === undefined
        && input.isOpen === undefined
        && input.orderIndex === undefined
      ) {
        return { invalidInput: true, notFound: false }
      }

      const now = Date.now()
      let pathChanged = false

      const oldFolderPathMap = buildFolderPathMap(state.folders)
      const oldPath = oldFolderPathMap.get(id)

      let targetName
        = input.name !== undefined
          ? validateEntryName(input.name, 'folder')
          : folder.name

      const { targetOrderIndex, targetParentId } = resolveFolderUpdateTargets(
        folder,
        input,
        normalizeNumber,
      )

      if (input.parentId !== undefined) {
        assertFolderMoveTargetValid(state.folders, id, targetParentId)
      }

      const isParentChanged = targetParentId !== folder.parentId
      if (isParentChanged) {
        targetName = resolveUniqueSiblingFolderName(
          state,
          targetParentId,
          targetName,
          id,
        )
      }
      else if (targetName !== folder.name) {
        assertUniqueSiblingFolderName(state, targetParentId, targetName, id)
      }

      if (targetName !== folder.name) {
        folder.name = targetName
        pathChanged = true
      }

      const { parentChanged } = applyFolderParentAndOrder(
        state.folders,
        folder,
        targetParentId,
        targetOrderIndex,
      )

      if (parentChanged) {
        pathChanged = true
      }

      if (input.isOpen !== undefined) {
        folder.isOpen = normalizeFlag(input.isOpen)
      }

      if (input.icon !== undefined) {
        folder.icon = input.icon
      }

      folder.updatedAt = now

      if (pathChanged) {
        const newFolderPathMap = buildFolderPathMap(state.folders)
        const newPath = newFolderPathMap.get(id)

        if (oldPath && newPath && oldPath !== newPath) {
          const targetParentPath = path.posix.dirname(newPath)
          assertDirectoryNameAvailableAtRoot(
            paths.httpRoot,
            targetParentPath === '.' ? '' : targetParentPath,
            path.posix.basename(newPath),
            oldPath,
          )

          moveFolderDirectoryOnDisk(paths.httpRoot, oldPath, newPath)

          updateChildEntityPaths({
            entries: [...cache.requestById.values()],
            getNextPath: (_, previousPath) =>
              replaceSubtreePathPrefix(previousPath, oldPath, newPath),
            onPathUpdated: (record, _previousPath, nextPath) => {
              const indexEntry = state.requests.find(r => r.id === record.id)
              if (indexEntry) {
                indexEntry.filePath = nextPath
              }
            },
          })

          const pathToFolderId = new Map<string, number>()
          newFolderPathMap.forEach((folderPath, folderId) => {
            pathToFolderId.set(folderPath, folderId)
          })
          syncRequestFolderId(
            [...cache.requestById.values()],
            state.requests,
            pathToFolderId,
          )
        }
      }

      saveHttpState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    deleteFolder(id: number) {
      const paths = resolvePaths()
      const cache = getHttpRuntimeCache(paths)
      const { state } = cache
      const folder = findHttpFolderById(state.folders, id)

      if (!folder) {
        return { deleted: false }
      }

      const descendantIds = collectDescendantIds(state.folders, id)
      descendantIds.add(id)

      const folderPathMap = buildFolderPathMap(state.folders)
      const folderPathsToDelete = getFolderPathsByDepth(
        folderPathMap,
        descendantIds,
      )

      removeFolderPathsFromDisk(paths.httpRoot, folderPathsToDelete, {
        ignoreErrors: true,
      })

      const removedRequestIds = new Set<number>()
      for (const record of cache.requestById.values()) {
        if (record.folderId !== null && descendantIds.has(record.folderId)) {
          removedRequestIds.add(record.id)
        }
      }

      if (removedRequestIds.size > 0) {
        for (const removedId of removedRequestIds) {
          cache.requestById.delete(removedId)
        }
        state.requests = state.requests.filter(
          entry => !removedRequestIds.has(entry.id),
        )
      }

      state.folders = state.folders.filter(f => !descendantIds.has(f.id))

      cache.folderById = new Map(
        state.folders.map(folder => [folder.id, folder]),
      )

      saveHttpState(paths, state)

      return { deleted: true }
    },
  }
}
