import type {
  SnippetContentUpdateInput,
  SnippetContentUpdateResult,
  SnippetsCount,
  SnippetsQueryInput,
  SnippetsStorage,
  SnippetTagDeleteRelationResult,
  SnippetTagRelationResult,
  SnippetUpdateResult,
} from '../../../contracts'
import path from 'node:path'
import {
  createSnippetRecord,
  findFolderById,
  findSnippetByContentId,
  findSnippetById,
  getPaths,
  getRuntimeCache,
  getSnippetIdsBySearchQuery,
  getSnippetTargetDirectory,
  getVaultPath,
  type MarkdownSnippet,
  normalizeDirectoryPath,
  persistSnippet,
  saveState,
  throwStorageError,
  validateEntryName,
  writeSnippetToFile,
} from '../runtime'
import {
  addTagToEntity,
  applyEntityUpdateFields,
  createEntityInStateAndDisk,
  deleteEntityFromStateAndDisk,
  deleteTagFromEntity,
  emptyEntityTrashFromStateAndDisk,
} from '../runtime/shared/entityStorage'

export function createSnippetsStorage(): SnippetsStorage {
  return {
    getSnippets: (query: SnippetsQueryInput) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const searchSnippetIds = query.search?.trim()
        ? getSnippetIdsBySearchQuery(snippets, query.search)
        : null
      const normalizedOrder = query.order || 'DESC'

      const filteredSnippets = snippets.filter((snippet) => {
        if (searchSnippetIds && !searchSnippetIds.has(snippet.id)) {
          return false
        }

        if (query.folderId && snippet.folderId !== query.folderId) {
          return false
        }

        if (query.isInbox && snippet.folderId !== null) {
          return false
        }

        if (query.tagId && !snippet.tags.includes(query.tagId)) {
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

      const result = filteredSnippets
        .map(snippet => createSnippetRecord(snippet, state))
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

      const name = validateEntryName(input.name, 'snippet')
      const folderId = input.folderId ?? null
      const result = createEntityInStateAndDisk<MarkdownSnippet>({
        createEntity: ({ folderId, id, name, now }) => ({
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
        }),
        entities: snippets,
        folderId,
        hasFolder: folderId => !!findFolderById(state, folderId),
        name,
        nextId: () => {
          state.counters.snippetId += 1
          return state.counters.snippetId
        },
        onFolderNotFound: () =>
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found'),
        persistEntity: snippet => persistSnippet(paths, state, snippet),
      })

      saveState(paths, state)

      return result
    },
    createSnippetContent: (snippetId, input) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, snippetId)

      if (!snippet) {
        throwStorageError('SNIPPET_NOT_FOUND', 'Snippet not found')
      }

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

      const previousPath = snippet.filePath
      const updateResult = applyEntityUpdateFields({
        entity: snippet,
        fieldPresence: 'in',
        folderExists: folderId => !!findFolderById(state, folderId),
        input,
        normalizeFlag: value => value || 0,
        onMissingFolder: () =>
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found'),
        resolveName: (inputName, currentName) =>
          validateEntryName(inputName || currentName, 'snippet'),
      })
      if (!updateResult.hasAnyField) {
        return {
          invalidInput: true,
          notFound: false,
        }
      }

      const movedToTrash
        = updateResult.previousIsDeleted !== 1 && snippet.isDeleted === 1
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
      const tag = state.tags.find(item => item.id === tagId)
      const result = addTagToEntity({
        entity: snippet,
        onUpdated: snippet => writeSnippetToFile(paths, snippet),
        tagExists: !!tag,
        tagId,
      })
      if (result.updated) {
        saveState(paths, state)
      }

      return {
        notFound: false,
        snippetFound: result.entityFound,
        tagFound: result.tagFound,
      }
    },
    deleteTagFromSnippet: (
      snippetId,
      tagId,
    ): SnippetTagDeleteRelationResult => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, snippetId)
      const tag = state.tags.find(item => item.id === tagId)
      const result = deleteTagFromEntity({
        entity: snippet,
        missingRelationFound: true,
        onUpdated: snippet => writeSnippetToFile(paths, snippet),
        tagExists: !!tag,
        tagId,
      })
      if (result.updated) {
        saveState(paths, state)
      }

      return {
        notFound: false,
        relationFound: result.relationFound,
        snippetFound: result.entityFound,
        tagFound: result.tagFound,
      }
    },
    deleteSnippet: (id) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const result = deleteEntityFromStateAndDisk({
        id,
        rootPath: paths.vaultPath,
        runtimeEntities: snippets,
        stateEntities: state.snippets,
      })
      if (!result.deleted) {
        return result
      }

      saveState(paths, state)

      return result
    },
    emptyTrash: () => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const result = emptyEntityTrashFromStateAndDisk({
        rootPath: paths.vaultPath,
        runtimeEntities: snippets,
        stateEntities: state.snippets,
      })
      if (!result.deletedCount) {
        return result
      }

      saveState(paths, state)

      return result
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
