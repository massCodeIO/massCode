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
import { prioritizeCloudDownload } from '../cloudDownloads'
import {
  assertUniqueSiblingEntryName,
  assertVaultNotHydrating,
  createSnippetRecord,
  ensureSnippetContentLoaded,
  findFolderById,
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
  assertEntityFileWritable,
  markEntityPendingIfEvicted,
  throwCloudContentUnavailable,
} from '../runtime/shared/cloudGuards'
import { createNestedContent } from '../runtime/shared/entityContent'
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

function findContentIndexById(
  snippet: MarkdownSnippet,
  contentId: number,
): number {
  return snippet.contents.findIndex(content => content.id === contentId)
}

export function createSnippetsStorage(): SnippetsStorage {
  return {
    getSnippets: (query: SnippetsQueryInput) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const search = query.search?.trim().toLowerCase()
      const searchSnippetIds
        = search && !query.searchNameOnly
          ? getSnippetIdsBySearchQuery(snippets, search)
          : null
      const result = filterAndSortByQuery({
        entities: snippets,
        filters: [
          snippet =>
            !search
            || !query.searchNameOnly
            || snippet.name.toLowerCase().includes(search),
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
        getSortValue: (snippet, sort) => {
          if (sort === 'name') {
            return snippet.name.toLowerCase()
          }

          if (sort === 'updatedAt') {
            return snippet.updatedAt
          }

          return snippet.createdAt
        },
        query,
      }).map(snippet => createSnippetRecord(snippet, state))

      return result
    },
    getSnippetById: (id: number) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, id)

      // Пользователь открыл ещё не докачанный сниппет: его файл поднимается
      // в начало очереди фоновой докачки, ответ при этом не блокируется.
      if (snippet?.pendingCloudDownload) {
        prioritizeCloudDownload(path.join(paths.vaultPath, snippet.filePath))
      }

      // Запись из индекса без тел: контент дочитывается по первому запросу.
      // Сбой дочитки (файл выгружен после скана, флаг ещё не обновился)
      // помечает запись pending: успешный ответ с пустыми телами без флага
      // открыл бы редактируемый пустой редактор, и набранный текст потерялся
      // бы на 503 при сохранении. Для уже гидрированной записи eviction
      // ловится свежим stat. Флаг снимет ресинк после докачки.
      if (snippet) {
        if (!ensureSnippetContentLoaded(paths, snippet)) {
          snippet.pendingCloudDownload = true
        }
        else {
          markEntityPendingIfEvicted(
            path.join(paths.vaultPath, snippet.filePath),
            snippet,
          )
        }
      }

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

      assertVaultNotHydrating(state)
      const name = validateEntryName(input.name, 'snippet')
      const folderId = input.folderId ?? null
      assertUniqueSiblingEntryName(snippets, folderId, name, 'snippet')
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

      // Проверка до мутации: createNestedContent пушит фрагмент в runtime
      // до записи файла.
      if (snippet) {
        assertEntityFileWritable(
          path.join(paths.vaultPath, snippet.filePath),
          snippet,
        )
      }

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

      // Проверка до мутации: иначе rename/move уже переместил бы файл и
      // изменил runtime, а запись frontmatter отклонилась.
      assertEntityFileWritable(
        path.join(paths.vaultPath, snippet.filePath),
        snippet,
      )

      const previousPath = snippet.filePath
      const previousFolderId = snippet.folderId
      const updateResult = applyEntityUpdateFields({
        entity: snippet,
        fieldPresence: 'in',
        folderExists: folderId => !!findFolderById(state, folderId),
        input,
        normalizeFlag: value => value || 0,
        onMissingFolder: () =>
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found'),
        resolveName: (inputName, currentName) => {
          const next = validateEntryName(inputName || currentName, 'snippet')
          const isFolderChanging
            = 'folderId' in input
              && (input.folderId ?? null) !== previousFolderId
          if (
            !isFolderChanging
            && next.toLowerCase() !== currentName.toLowerCase()
          ) {
            assertUniqueSiblingEntryName(
              snippets,
              previousFolderId,
              next,
              'snippet',
              snippet.id,
            )
          }
          return next
        },
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
        // Перенос в trash не требует перезаписи frontmatter (isDeleted
        // выводится из trash-каталога), поэтому недокачанный файл не должен
        // блокировать удаление.
        skipWriteIfUnavailable: movedToTrash,
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

      if (!('label' in input || 'value' in input || 'language' in input)) {
        return {
          invalidInput: true,
          notFound: false,
          parentNotFound: false,
        }
      }

      const snippet = findSnippetById(snippets, snippetId)
      if (!snippet) {
        return {
          invalidInput: false,
          notFound: false,
          parentNotFound: true,
        }
      }

      const contentIndex = findContentIndexById(snippet, contentId)
      if (contentIndex === -1) {
        return {
          invalidInput: false,
          notFound: true,
          parentNotFound: false,
        }
      }

      // Проверка и дочитка тел до мутации: иначе патч частично применился
      // бы в памяти, а запись на диск отклонилась.
      assertEntityFileWritable(
        path.join(paths.vaultPath, snippet.filePath),
        snippet,
      )
      if (!ensureSnippetContentLoaded(paths, snippet)) {
        throwCloudContentUnavailable()
      }

      const content = snippet.contents[contentIndex]

      if ('label' in input) {
        content.label = input.label || content.label
      }

      if ('value' in input) {
        content.value = input.value ?? null
      }

      if ('language' in input) {
        content.language = input.language || content.language
      }

      snippet.updatedAt = Date.now()
      writeSnippetToFile(paths, snippet)
      saveState(paths, state)

      return {
        invalidInput: false,
        notFound: false,
        parentNotFound: false,
      }
    },
    addTagToSnippet: (snippetId, tagId): SnippetTagRelationResult => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, snippetId)
      const tag = state.tags.find(item => item.id === tagId)

      // Проверка до мутации: addTagToEntity меняет runtime до записи файла.
      if (snippet && tag) {
        assertEntityFileWritable(
          path.join(paths.vaultPath, snippet.filePath),
          snippet,
        )
      }

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

      // Проверка до мутации: deleteTagFromEntity меняет runtime до записи
      // файла.
      if (snippet && tag) {
        assertEntityFileWritable(
          path.join(paths.vaultPath, snippet.filePath),
          snippet,
        )
      }

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
    deleteSnippetContent: (snippetId, contentId) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)
      const snippet = findSnippetById(snippets, snippetId)

      if (!snippet) {
        return { deleted: false }
      }

      const contentIndex = findContentIndexById(snippet, contentId)
      if (contentIndex === -1) {
        return { deleted: false }
      }

      // Проверка и дочитка тел ДО удаления: доливка null-value в guard'e
      // записи идёт по позициям против ещё полного файла, и после splice
      // каждый следующий фрагмент получил бы тело соседа.
      assertEntityFileWritable(
        path.join(paths.vaultPath, snippet.filePath),
        snippet,
      )
      if (!ensureSnippetContentLoaded(paths, snippet)) {
        throwCloudContentUnavailable()
      }

      snippet.contents.splice(contentIndex, 1)
      snippet.updatedAt = Date.now()
      writeSnippetToFile(paths, snippet)
      saveState(paths, state)

      return { deleted: true }
    },
  }
}
