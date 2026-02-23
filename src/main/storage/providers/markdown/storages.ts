import type {
  FolderRecord,
  FoldersStorage,
  FolderTreeRecord,
  FolderUpdateResult,
  SnippetContentUpdateInput,
  SnippetContentUpdateResult,
  SnippetsCount,
  SnippetsQueryInput,
  SnippetsStorage,
  SnippetTagDeleteRelationResult,
  SnippetTagRelationResult,
  SnippetUpdateResult,
  StorageProvider,
  TagsStorage,
} from '../../contracts'
import path from 'node:path'
import fs from 'fs-extra'
import {
  assertDirectoryNameAvailable,
  assertNotReservedRootFolderName,
  assertUniqueSiblingFolderName,
  buildFolderPathMap,
  buildSnippetTargetPath,
  createSnippetRecord,
  depthOfRelativePath,
  findFolderById,
  findSnippetByContentId,
  findSnippetById,
  getFolderPathById,
  getNextFolderOrder,
  getPaths,
  getRuntimeCache,
  getSnippetTargetDirectory,
  getVaultPath,
  type MarkdownSnippet,
  normalizeDirectoryPath,
  normalizeFlag,
  persistSnippet,
  resolveUniqueSiblingFolderName,
  saveState,
  syncCounters,
  syncFolderMetadataFiles,
  throwStorageError,
  validateEntryName,
  writeSnippetToFile,
} from './runtime'

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

function createFoldersStorage(): FoldersStorage {
  return {
    getFolders: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return [...state.folders].sort((a, b) => b.createdAt - a.createdAt)
    },
    getFoldersTree: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return createFolderTree(
        [...state.folders].sort((a, b) => {
          if (a.parentId === b.parentId) {
            return a.orderIndex - b.orderIndex
          }

          if (a.parentId === null) {
            return -1
          }

          if (b.parentId === null) {
            return 1
          }

          return a.parentId - b.parentId
        }),
      )
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

function createTagsStorage(): TagsStorage {
  return {
    getTags: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return state.tags
        .map(tag => ({
          id: tag.id,
          name: tag.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    createTag: (name) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      syncCounters(state, snippets)

      const id = state.counters.tagId + 1
      state.counters.tagId = id

      const now = Date.now()
      state.tags.push({
        createdAt: now,
        id,
        name,
        updatedAt: now,
      })

      saveState(paths, state)

      return { id }
    },
    deleteTag: (id) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const tagIndex = state.tags.findIndex(tag => tag.id === id)
      if (tagIndex === -1) {
        return { deleted: false }
      }

      state.tags.splice(tagIndex, 1)

      snippets.forEach((snippet) => {
        if (snippet.tags.includes(id)) {
          snippet.tags = snippet.tags.filter(tagId => tagId !== id)
          writeSnippetToFile(paths, snippet)
        }
      })

      saveState(paths, state)

      return { deleted: true }
    },
  }
}

function createSnippetsStorage(): SnippetsStorage {
  return {
    getSnippets: (query: SnippetsQueryInput) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const normalizedSearchQuery = query.search?.toLowerCase()
      const normalizedOrder = query.order || 'DESC'

      const result = snippets
        .map(snippet => createSnippetRecord(snippet, state))
        .filter((snippet) => {
          if (normalizedSearchQuery) {
            const inName = snippet.name
              .toLowerCase()
              .includes(normalizedSearchQuery)
            const inDescription = (snippet.description || '')
              .toLowerCase()
              .includes(normalizedSearchQuery)
            const inContent = snippet.contents.some(content =>
              (content.value || '')
                .toLowerCase()
                .includes(normalizedSearchQuery),
            )

            if (!inName && !inDescription && !inContent) {
              return false
            }
          }

          if (query.folderId && snippet.folder?.id !== query.folderId) {
            return false
          }

          if (query.isInbox && snippet.folder !== null) {
            return false
          }

          if (
            query.tagId
            && !snippet.tags.some(tag => tag.id === query.tagId)
          ) {
            return false
          }

          if (query.isFavorites && snippet.isFavorites !== 1) {
            return false
          }

          if (query.isDeleted) {
            if (snippet.isDeleted !== 1) {
              return false
            }
          }
          else if (snippet.isDeleted !== 0) {
            return false
          }

          return true
        })
        .sort((a, b) => {
          if (normalizedOrder === 'ASC') {
            return a.createdAt - b.createdAt
          }

          return b.createdAt - a.createdAt
        })

      return result
    },
    getSnippetsCounts: (): SnippetsCount => {
      const paths = getPaths(getVaultPath())
      const { snippets } = getRuntimeCache(paths)

      return {
        total: snippets.length,
        trash: snippets.filter(snippet => snippet.isDeleted === 1).length,
      }
    },
    createSnippet: (input) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      syncCounters(state, snippets)

      const name = validateEntryName(input.name, 'snippet')
      const folderId = input.folderId ?? null

      if (folderId !== null && !findFolderById(state, folderId)) {
        throwStorageError('FOLDER_NOT_FOUND', 'Folder not found')
      }

      const id = state.counters.snippetId + 1
      state.counters.snippetId = id

      const now = Date.now()
      const snippet: MarkdownSnippet = {
        contents: [],
        createdAt: now,
        description: null,
        filePath: '',
        folderId,
        id,
        isDeleted: 0,
        isFavorites: 0,
        name,
        tags: [],
        updatedAt: now,
      }

      persistSnippet(paths, state, snippet)
      snippets.push(snippet)
      saveState(paths, state)

      return { id }
    },
    createSnippetContent: (snippetId, input) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, snippetId)

      if (!snippet) {
        throwStorageError('SNIPPET_NOT_FOUND', 'Snippet not found')
      }

      syncCounters(state, snippets)

      const contentId = state.counters.contentId + 1
      state.counters.contentId = contentId

      snippet.contents.push({
        id: contentId,
        label: input.label,
        language: input.language,
        value: input.value,
      })

      snippet.updatedAt = Date.now()
      writeSnippetToFile(paths, snippet)
      saveState(paths, state)

      return { id: contentId }
    },
    updateSnippet: (id, input): SnippetUpdateResult => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, id)

      if (!snippet) {
        return {
          invalidInput: false,
          notFound: true,
        }
      }

      const hasAnyField
        = 'name' in input
          || 'description' in input
          || 'folderId' in input
          || 'isFavorites' in input
          || 'isDeleted' in input

      if (!hasAnyField) {
        return {
          invalidInput: true,
          notFound: false,
        }
      }

      const previousPath = snippet.filePath
      const wasDeleted = snippet.isDeleted

      if ('name' in input) {
        snippet.name = validateEntryName(input.name || snippet.name, 'snippet')
      }

      if ('description' in input) {
        snippet.description = input.description ?? null
      }

      if ('folderId' in input) {
        const nextFolderId = input.folderId ?? null

        if (nextFolderId !== null && !findFolderById(state, nextFolderId)) {
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found')
        }

        snippet.folderId = nextFolderId
      }

      if ('isFavorites' in input) {
        snippet.isFavorites = input.isFavorites || 0
      }

      if ('isDeleted' in input) {
        snippet.isDeleted = input.isDeleted || 0
      }

      const movedToTrash = wasDeleted !== 1 && snippet.isDeleted === 1
      const previousDirectory = normalizeDirectoryPath(
        path.posix.dirname(previousPath),
      )
      const nextDirectory = getSnippetTargetDirectory(state, snippet)
      const movedBetweenDirectories = previousDirectory !== nextDirectory

      snippet.updatedAt = Date.now()
      persistSnippet(paths, state, snippet, previousPath, {
        allowRenameOnConflict: movedToTrash || movedBetweenDirectories,
      })
      saveState(paths, state)

      return {
        invalidInput: false,
        notFound: false,
      }
    },
    updateSnippetContent: (
      snippetId,
      contentId,
      input: SnippetContentUpdateInput,
    ): SnippetContentUpdateResult => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const hasAnyField
        = 'label' in input || 'value' in input || 'language' in input

      if (!hasAnyField) {
        return {
          invalidInput: true,
          notFound: false,
          parentNotFound: false,
        }
      }

      const ownedContent = findSnippetByContentId(snippets, contentId)
      if (!ownedContent) {
        return {
          invalidInput: false,
          notFound: true,
          parentNotFound: false,
        }
      }

      const { contentIndex, snippet: contentOwnerSnippet } = ownedContent
      const content = contentOwnerSnippet.contents[contentIndex]

      if ('label' in input) {
        content.label = input.label || content.label
      }

      if ('value' in input) {
        content.value = input.value ?? null
      }

      if ('language' in input) {
        content.language = input.language || content.language
      }

      let parentNotFound = false
      if (contentOwnerSnippet.id === snippetId) {
        contentOwnerSnippet.updatedAt = Date.now()
        writeSnippetToFile(paths, contentOwnerSnippet)
      }
      else {
        writeSnippetToFile(paths, contentOwnerSnippet)

        const targetSnippet = findSnippetById(snippets, snippetId)
        if (targetSnippet) {
          targetSnippet.updatedAt = Date.now()
          writeSnippetToFile(paths, targetSnippet)
        }
        else {
          parentNotFound = true
        }
      }

      saveState(paths, state)

      return {
        invalidInput: false,
        notFound: false,
        parentNotFound,
      }
    },
    addTagToSnippet: (snippetId, tagId): SnippetTagRelationResult => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, snippetId)

      if (!snippet) {
        return {
          notFound: false,
          snippetFound: false,
          tagFound: true,
        }
      }

      const tag = state.tags.find(item => item.id === tagId)
      if (!tag) {
        return {
          notFound: false,
          snippetFound: true,
          tagFound: false,
        }
      }

      if (!snippet.tags.includes(tagId)) {
        snippet.tags.push(tagId)
        writeSnippetToFile(paths, snippet)
        saveState(paths, state)
      }

      return {
        notFound: false,
        snippetFound: true,
        tagFound: true,
      }
    },
    deleteTagFromSnippet: (
      snippetId,
      tagId,
    ): SnippetTagDeleteRelationResult => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, snippetId)

      if (!snippet) {
        return {
          notFound: false,
          relationFound: true,
          snippetFound: false,
          tagFound: true,
        }
      }

      const tag = state.tags.find(item => item.id === tagId)
      if (!tag) {
        return {
          notFound: false,
          relationFound: true,
          snippetFound: true,
          tagFound: false,
        }
      }

      const relationFound = snippet.tags.includes(tagId)
      if (relationFound) {
        snippet.tags = snippet.tags.filter(item => item !== tagId)
        writeSnippetToFile(paths, snippet)
        saveState(paths, state)
      }

      return {
        notFound: false,
        relationFound,
        snippetFound: true,
        tagFound: true,
      }
    },
    deleteSnippet: (id) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const snippetIndex = state.snippets.findIndex(
        snippet => snippet.id === id,
      )
      if (snippetIndex === -1) {
        return { deleted: false }
      }

      const snippet = state.snippets[snippetIndex]
      fs.removeSync(path.join(paths.vaultPath, snippet.filePath))

      state.snippets.splice(snippetIndex, 1)
      const snippetRuntimeIndex = snippets.findIndex(
        snippet => snippet.id === id,
      )
      if (snippetRuntimeIndex !== -1) {
        snippets.splice(snippetRuntimeIndex, 1)
      }
      saveState(paths, state)

      return { deleted: true }
    },
    emptyTrash: () => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const deletedSnippetIds = new Set<number>(
        snippets
          .filter(snippet => snippet.isDeleted === 1)
          .map(snippet => snippet.id),
      )

      if (!deletedSnippetIds.size) {
        return { deletedCount: 0 }
      }

      state.snippets = state.snippets.filter((snippet) => {
        if (deletedSnippetIds.has(snippet.id)) {
          fs.removeSync(path.join(paths.vaultPath, snippet.filePath))
          return false
        }

        return true
      })
      const nextSnippets = snippets.filter(
        snippet => !deletedSnippetIds.has(snippet.id),
      )
      snippets.splice(0, snippets.length, ...nextSnippets)

      saveState(paths, state)

      return { deletedCount: deletedSnippetIds.size }
    },
    deleteSnippetContent: (contentId) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const ownedContent = findSnippetByContentId(snippets, contentId)

      if (!ownedContent) {
        return { deleted: false }
      }

      ownedContent.snippet.contents.splice(ownedContent.contentIndex, 1)
      ownedContent.snippet.updatedAt = Date.now()
      writeSnippetToFile(paths, ownedContent.snippet)
      saveState(paths, state)

      return { deleted: true }
    },
  }
}

export function createMarkdownStorageProvider(): StorageProvider {
  return {
    folders: createFoldersStorage(),
    snippets: createSnippetsStorage(),
    tags: createTagsStorage(),
  }
}
