import type {
  FolderRecord,
  FoldersStorage,
  FolderTreeRecord,
  FolderUpdateResult,
} from '../../../contracts'
import path from 'node:path'
import fs from 'fs-extra'
import {
  assertDirectoryNameAvailable,
  assertNotReservedRootFolderName,
  assertUniqueSiblingFolderName,
  buildFolderPathMap,
  buildSnippetTargetPath,
  depthOfRelativePath,
  findFolderById,
  getFolderPathById,
  getNextFolderOrder,
  getPaths,
  getRuntimeCache,
  getVaultPath,
  normalizeDirectoryPath,
  normalizeFlag,
  persistSnippet,
  resolveUniqueSiblingFolderName,
  saveState,
  syncFolderMetadataFiles,
  throwStorageError,
  validateEntryName,
} from '../runtime'

function createFolderTree(folders: FolderRecord[]): FolderTreeRecord[] {
  const folderMap = new Map<number, FolderTreeRecord>()
  const rootFolders: FolderTreeRecord[] = []

  folders.forEach((folder) => {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
    })
  })

  folderMap.forEach((folder) => {
    if (folder.parentId === null) {
      rootFolders.push(folder)
      return
    }

    const parent = folderMap.get(folder.parentId)
    if (parent) {
      parent.children.push(folder)
    }
  })

  return rootFolders
}

function sortFoldersForTree(folders: FolderRecord[]): FolderRecord[] {
  const folderByParent = new Map<number | null, FolderRecord[]>()
  const knownFolderIds = new Set<number>(folders.map(folder => folder.id))

  folders.forEach((folder) => {
    const parentId
      = folder.parentId !== null && knownFolderIds.has(folder.parentId)
        ? folder.parentId
        : null
    const siblings = folderByParent.get(parentId) || []

    siblings.push(folder)
    folderByParent.set(parentId, siblings)
  })

  folderByParent.forEach((siblings, parentId) => {
    siblings.sort((firstFolder, secondFolder) => {
      if (firstFolder.orderIndex !== secondFolder.orderIndex) {
        return firstFolder.orderIndex - secondFolder.orderIndex
      }

      return firstFolder.id - secondFolder.id
    })
    folderByParent.set(parentId, siblings)
  })

  const orderedFolders: FolderRecord[] = []
  const visitedFolderIds = new Set<number>()

  const visitChildren = (parentId: number | null): void => {
    const children = folderByParent.get(parentId) || []
    children.forEach((child) => {
      if (visitedFolderIds.has(child.id)) {
        return
      }

      visitedFolderIds.add(child.id)
      orderedFolders.push(child)
      visitChildren(child.id)
    })
  }

  visitChildren(null)

  folders.forEach((folder) => {
    if (visitedFolderIds.has(folder.id)) {
      return
    }

    orderedFolders.push(folder)
    visitChildren(folder.id)
  })

  return orderedFolders
}

function findFolderDescendants(
  folders: FolderRecord[],
  folderId: number,
): number[] {
  const directChildren = folders
    .filter(folder => folder.parentId === folderId)
    .map(folder => folder.id)

  let descendants = [...directChildren]

  for (const childId of directChildren) {
    descendants = descendants.concat(findFolderDescendants(folders, childId))
  }

  return descendants
}

export function createFoldersStorage(): FoldersStorage {
  return {
    getFolders: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return [...state.folders].sort((a, b) => b.createdAt - a.createdAt)
    },
    getFoldersTree: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return createFolderTree(sortFoldersForTree([...state.folders]))
    },
    createFolder: (input) => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      const name = validateEntryName(input.name, 'folder')
      const parentId = input.parentId ?? null

      if (parentId !== null && !findFolderById(state, parentId)) {
        throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
      }

      assertNotReservedRootFolderName(parentId, name)
      assertUniqueSiblingFolderName(state, parentId, name)

      const parentPath
        = parentId !== null ? getFolderPathById(state, parentId) : ''
      const normalizedParentPath = normalizeDirectoryPath(parentPath || '')
      assertDirectoryNameAvailable(paths, normalizedParentPath, name)

      const targetDirectory = normalizedParentPath
        ? path.join(paths.vaultPath, normalizedParentPath, name)
        : path.join(paths.vaultPath, name)
      fs.ensureDirSync(targetDirectory)

      const now = Date.now()
      const id = state.counters.folderId + 1
      state.counters.folderId = id

      state.folders.push({
        createdAt: now,
        defaultLanguage: 'plain_text',
        icon: null,
        id,
        isOpen: 0,
        name,
        orderIndex: getNextFolderOrder(state, parentId),
        parentId,
        updatedAt: now,
      })

      syncFolderMetadataFiles(paths, state)
      saveState(paths, state)

      return { id }
    },
    updateFolder: (id, input): FolderUpdateResult => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const folder = findFolderById(state, id)
      if (!folder) {
        return {
          invalidInput: false,
          notFound: true,
        }
      }

      const hasAnyField
        = 'name' in input
          || 'icon' in input
          || 'defaultLanguage' in input
          || 'parentId' in input
          || 'isOpen' in input
          || 'orderIndex' in input

      if (!hasAnyField) {
        return {
          invalidInput: true,
          notFound: false,
        }
      }

      const oldFolderPathMap = buildFolderPathMap(state)
      const oldFolderPath = oldFolderPathMap.get(folder.id) || ''

      let targetName
        = 'name' in input
          ? validateEntryName(input.name || folder.name, 'folder')
          : folder.name
      const targetParentId
        = 'parentId' in input ? (input.parentId ?? null) : folder.parentId

      if (targetParentId !== null && !findFolderById(state, targetParentId)) {
        throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
      }

      const descendants = findFolderDescendants(state.folders, id)
      if (targetParentId !== null && descendants.includes(targetParentId)) {
        throwStorageError(
          'INVALID_NAME',
          'Folder cannot be moved into its own subtree',
        )
      }

      assertNotReservedRootFolderName(targetParentId, targetName)

      const isParentChanged = targetParentId !== folder.parentId
      if (isParentChanged) {
        targetName = resolveUniqueSiblingFolderName(
          state,
          targetParentId,
          targetName,
          id,
        )
      }
      else {
        assertUniqueSiblingFolderName(state, targetParentId, targetName, id)
      }

      const currentParentId = folder.parentId
      const currentOrderIndex = folder.orderIndex
      const targetOrderIndex
        = 'orderIndex' in input
          ? (input.orderIndex ?? currentOrderIndex)
          : currentOrderIndex

      if (
        targetParentId !== currentParentId
        || targetOrderIndex !== currentOrderIndex
      ) {
        if (targetParentId === currentParentId) {
          if (targetOrderIndex > currentOrderIndex) {
            state.folders.forEach((item) => {
              if (
                item.id !== folder.id
                && item.parentId === currentParentId
                && item.orderIndex > currentOrderIndex
                && item.orderIndex <= targetOrderIndex
              ) {
                item.orderIndex -= 1
              }
            })
          }
          else {
            state.folders.forEach((item) => {
              if (
                item.id !== folder.id
                && item.parentId === currentParentId
                && item.orderIndex >= targetOrderIndex
                && item.orderIndex < currentOrderIndex
              ) {
                item.orderIndex += 1
              }
            })
          }
        }
        else {
          state.folders.forEach((item) => {
            if (
              item.id !== folder.id
              && item.parentId === currentParentId
              && item.orderIndex > currentOrderIndex
            ) {
              item.orderIndex -= 1
            }
          })

          state.folders.forEach((item) => {
            if (
              item.id !== folder.id
              && item.parentId === targetParentId
              && item.orderIndex >= targetOrderIndex
            ) {
              item.orderIndex += 1
            }
          })
        }

        folder.parentId = targetParentId
        folder.orderIndex = targetOrderIndex
      }

      if ('name' in input || folder.name !== targetName) {
        folder.name = targetName
      }

      if ('icon' in input) {
        folder.icon = input.icon ?? null
      }

      if ('defaultLanguage' in input) {
        folder.defaultLanguage
          = input.defaultLanguage || folder.defaultLanguage
      }

      if ('isOpen' in input) {
        folder.isOpen = normalizeFlag(input.isOpen, folder.isOpen)
      }

      folder.updatedAt = Date.now()

      const newFolderPathMap = buildFolderPathMap(state)
      const newFolderPath = newFolderPathMap.get(folder.id) || ''

      if (oldFolderPath !== newFolderPath) {
        const targetParentPath = normalizeDirectoryPath(
          path.posix.dirname(newFolderPath),
        )
        assertDirectoryNameAvailable(
          paths,
          targetParentPath,
          path.posix.basename(newFolderPath),
          oldFolderPath,
        )

        const oldAbsolutePath = path.join(paths.vaultPath, oldFolderPath)
        const newAbsolutePath = path.join(paths.vaultPath, newFolderPath)

        if (fs.pathExistsSync(oldAbsolutePath)) {
          fs.ensureDirSync(path.dirname(newAbsolutePath))
          fs.moveSync(oldAbsolutePath, newAbsolutePath, { overwrite: false })
        }

        const affectedFolderIds = new Set<number>([
          id,
          ...findFolderDescendants(state.folders, id),
        ])

        snippets.forEach((snippet) => {
          if (snippet.isDeleted === 1) {
            return
          }

          if (
            snippet.folderId === null
            || !affectedFolderIds.has(snippet.folderId)
          ) {
            return
          }

          const previousPath = snippet.filePath
          snippet.filePath = buildSnippetTargetPath(state, snippet)

          const oldSnippetAbsolutePath = path.join(
            paths.vaultPath,
            previousPath,
          )
          const newSnippetAbsolutePath = path.join(
            paths.vaultPath,
            snippet.filePath,
          )

          if (
            previousPath !== snippet.filePath
            && fs.pathExistsSync(oldSnippetAbsolutePath)
            && !fs.pathExistsSync(newSnippetAbsolutePath)
          ) {
            fs.ensureDirSync(path.dirname(newSnippetAbsolutePath))
            fs.moveSync(oldSnippetAbsolutePath, newSnippetAbsolutePath, {
              overwrite: false,
            })
          }
        })
      }

      syncFolderMetadataFiles(paths, state)
      saveState(paths, state)

      return {
        invalidInput: false,
        notFound: false,
      }
    },
    deleteFolder: (id) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const folder = findFolderById(state, id)
      if (!folder) {
        return { deleted: false }
      }

      const oldFolderPathMap = buildFolderPathMap(state)
      const descendantIds = findFolderDescendants(state.folders, id)
      const removedFolderIds = new Set<number>([id, ...descendantIds])
      const directoryEntriesCache = new Map<string, string[]>()

      snippets.forEach((snippet) => {
        if (
          snippet.folderId !== null
          && removedFolderIds.has(snippet.folderId)
        ) {
          const previousPath = snippet.filePath
          snippet.folderId = null
          snippet.isDeleted = 1
          snippet.updatedAt = Date.now()
          persistSnippet(paths, state, snippet, previousPath, {
            allowRenameOnConflict: true,
            directoryEntriesCache,
          })
        }
      })

      const removedFolderPaths = [...removedFolderIds]
        .map(folderId => oldFolderPathMap.get(folderId))
        .filter((folderPath): folderPath is string => !!folderPath)
        .sort((a, b) => depthOfRelativePath(b) - depthOfRelativePath(a))

      state.folders = state.folders.filter(
        folder => !removedFolderIds.has(folder.id),
      )

      removedFolderPaths.forEach((folderPath) => {
        const absolutePath = path.join(paths.vaultPath, folderPath)
        if (fs.pathExistsSync(absolutePath)) {
          fs.removeSync(absolutePath)
        }
      })

      saveState(paths, state)

      return { deleted: true }
    },
  }
}
