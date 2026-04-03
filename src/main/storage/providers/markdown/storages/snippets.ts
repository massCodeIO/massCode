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
  createNestedContent,
  deleteNestedContent,
  updateNestedContent,
} from '../runtime/shared/entityContent'
import { filterAndSortByQuery } from '../runtime/shared/entityQuery'
import {
  addTagToEntity,
  applyEntityUpdateFields,
  createEntityInStateAndDisk,
  deleteEntityFromStateAndDisk,
  deleteTagFromEntity,
  emptyEntityTrashFromStateAndDisk,
  getEntityDeleteCounts,
} from '../runtime/shared/entityStorage'

export function createSnippetsStorage(): SnippetsStorage {
  return {
    getSnippets: (query: SnippetsQueryInput) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const searchSnippetIds = query.search?.trim()
        ? getSnippetIdsBySearchQuery(snippets, query.search)
        : null
      const result = filterAndSortByQuery({
        entities: snippets,
        filters: [
          snippet => !searchSnippetIds || searchSnippetIds.has(snippet.id),
          (snippet, query) =>
            !query.folderId || snippet.folderId === query.folderId,
          (snippet, query) => !query.isInbox || snippet.folderId === null,
          (snippet, query) =>
            !query.tagId || snippet.tags.includes(query.tagId),
          (snippet, query) => !query.isFavorites || snippet.isFavorites === 1,
          (snippet, query) =>
            query.isDeleted ? snippet.isDeleted === 1 : snippet.isDeleted === 0,
        ],
        getSortValue: snippet => snippet.createdAt,
        query,
      }).map(snippet => createSnippetRecord(snippet, state))

      return result
    },
    getSnippetById: (id: number) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, id)

      return snippet ? createSnippetRecord(snippet, state) : null
    },
    getSnippetsCounts: (): SnippetsCount => {
      const paths = getPaths(getVaultPath())
      const { snippets } = getRuntimeCache(paths)

      return getEntityDeleteCounts(snippets, { includeDeletedInTotal: true })
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
      const result = createNestedContent({
        createContent: contentId => ({
          id: contentId,
          label: input.label,
          language: input.language,
          value: input.value,
        }),
        nextContentId: () => {
          state.counters.contentId += 1
          return state.counters.contentId
        },
        onOwnerNotFound: () =>
          throwStorageError('SNIPPET_NOT_FOUND', 'Snippet not found'),
        owner: snippet,
        persistOwner: snippet => writeSnippetToFile(paths, snippet),
      })

      saveState(paths, state)

      return result
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
      const ownedContent = findSnippetByContentId(snippets, contentId)
      const result = updateNestedContent({
        applyPatch: (content, patch) => {
          if ('label' in patch) {
            content.label = patch.label || content.label
          }

          if ('value' in patch) {
            content.value = patch.value ?? null
          }

          if ('language' in patch) {
            content.language = patch.language || content.language
          }
        },
        findTargetOwnerById: id => findSnippetById(snippets, id),
        hasAnyField: patch =>
          'label' in patch || 'value' in patch || 'language' in patch,
        ownerId: snippetId,
        ownedContent: ownedContent
          ? {
              contentIndex: ownedContent.contentIndex,
              owner: ownedContent.snippet,
            }
          : undefined,
        patch: input,
        persistOwner: snippet => writeSnippetToFile(paths, snippet),
      })
      if (!result.invalidInput && !result.notFound) {
        saveState(paths, state)
      }

      return result
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
      const result = deleteNestedContent({
        ownedContent: ownedContent
          ? {
              contentIndex: ownedContent.contentIndex,
              owner: ownedContent.snippet,
            }
          : undefined,
        persistOwner: snippet => writeSnippetToFile(paths, snippet),
      })
      if (!result.deleted) {
        return result
      }

      saveState(paths, state)

      return result
    },
  }
}
