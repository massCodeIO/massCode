import type { FoldersStorage, FolderUpdateResult } from '../../../contracts'
import path from 'node:path'
import fs from 'fs-extra'
import { scheduleDockBadgeRefresh } from '../../../../dockBadge'
import {
  assertDirectoryNameAvailable,
  assertNotReservedRootFolderName,
  assertUniqueSiblingFolderName,
  buildFolderPathMap,
  buildSnippetTargetPath,
  collectDescendantIds,
  findFolderById,
  getFolderPathById,
  getNextFolderOrder,
  getPaths,
  getRuntimeCache,
  getVaultPath,
  isCodeVaultDiskReady,
  normalizeDirectoryPath,
  normalizeFlag,
  persistSnippet,
  resolveUniqueSiblingFolderName,
  saveState,
  syncFolderMetadataFiles,
  throwStorageError,
  validateEntryName,
} from '../runtime'
import {
  applyFolderParentAndOrder,
  assertFolderMoveTargetValid,
  assertNoUnknownDomainFiles,
  createFolderInStateAndDisk,
  getFolderPathsByDepth,
  getFoldersSortedByCreatedAt,
  getFoldersTreeSorted,
  moveFolderDirectoryOnDisk,
  removeFolderPathsFromDisk,
  resolveFolderUpdateTargets,
  updateChildEntityPaths,
} from '../runtime/shared/foldersStorage'

export function createFoldersStorage(): FoldersStorage {
  return {
    getFolders: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return getFoldersSortedByCreatedAt(state.folders)
    },
    getFoldersTree: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return getFoldersTreeSorted(state.folders)
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

      const { id } = createFolderInStateAndDisk({
        buildFolderPathMap,
        createFolder: ({ id, name, now, orderIndex, parentId }) => ({
          createdAt: now,
          defaultLanguage: 'plain_text',
          icon: null,
          id,
          isOpen: 0,
          name,
          orderIndex,
          parentId,
          updatedAt: now,
        }),
        getNextFolderOrder,
        name,
        parentId,
        rootPath: paths.vaultPath,
        state,
      })

      syncFolderMetadataFiles(paths, state)
      saveState(paths, state)

      return { id }
    },
    updateFolder: (id, input): FolderUpdateResult => {
      const paths = getPaths(getVaultPath())

      // Rename/move каталога до завершения фоновой сверки работал бы по
      // пустому provisional-списку записей: файлы переместились бы на диске,
      // а index paths и связи остались бы старыми.
      if (
        ('name' in input || 'parentId' in input)
        && !isCodeVaultDiskReady(paths)
      ) {
        throwStorageError(
          'VAULT_HYDRATING',
          'Vault is still syncing, folder rename or move is not available yet',
        )
      }

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
      const { targetOrderIndex, targetParentId } = resolveFolderUpdateTargets(
        folder,
        {
          orderIndex: input.orderIndex,
          parentId: input.parentId,
        },
      )

      assertFolderMoveTargetValid(state.folders, id, targetParentId)

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

      applyFolderParentAndOrder(
        state.folders,
        folder,
        targetParentId,
        targetOrderIndex,
      )

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

        moveFolderDirectoryOnDisk(
          paths.vaultPath,
          oldFolderPath,
          newFolderPath,
        )

        const affectedFolderIds = collectDescendantIds(state.folders, id)
        affectedFolderIds.add(id)

        updateChildEntityPaths({
          entries: snippets,
          getNextPath: snippet => buildSnippetTargetPath(state, snippet),
          onPathUpdated: (_, previousPath, nextPath) => {
            const oldSnippetAbsolutePath = path.join(
              paths.vaultPath,
              previousPath,
            )
            const newSnippetAbsolutePath = path.join(paths.vaultPath, nextPath)

            if (
              fs.pathExistsSync(oldSnippetAbsolutePath)
              && !fs.pathExistsSync(newSnippetAbsolutePath)
            ) {
              fs.ensureDirSync(path.dirname(newSnippetAbsolutePath))
              fs.moveSync(oldSnippetAbsolutePath, newSnippetAbsolutePath, {
                overwrite: false,
              })
            }
          },
          shouldUpdate: (snippet) => {
            if (snippet.isDeleted === 1 || snippet.folderId === null) {
              return false
            }

            return affectedFolderIds.has(snippet.folderId)
          },
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

      // До завершения фоновой сверки runtime-кэш provisional: список записей
      // пуст, перенос содержимого папки в trash ничего бы не нашёл, а
      // removeFolderPathsFromDisk физически уничтожил бы файлы на диске.
      if (!isCodeVaultDiskReady(paths)) {
        throwStorageError(
          'VAULT_HYDRATING',
          'Vault is still syncing, folder deletion is not available yet',
        )
      }

      const { state, snippets } = getRuntimeCache(paths)

      const folder = findFolderById(state, id)
      if (!folder) {
        return { deleted: false }
      }

      const oldFolderPathMap = buildFolderPathMap(state)
      const removedFolderIds = collectDescendantIds(state.folders, id)
      removedFolderIds.add(id)
      const directoryEntriesCache = new Map<string, string[]>()

      const removedFolderPaths = getFolderPathsByDepth(
        oldFolderPathMap,
        removedFolderIds,
      )

      // Доменный .md без записи в runtime (плейсхолдер с другого устройства,
      // сбой чтения при скане) физически уничтожился бы вместе с каталогом:
      // удаление отклоняется целиком. Обход стартует с корня удаляемой папки
      // (вложенные каталоги покрываются рекурсией). Известные записи
      // переносятся в trash штатно, включая pending (их trash-маркер — путь).
      const topFolderPath = oldFolderPathMap.get(id)
      const knownFilePaths = new Set(
        snippets
          .filter(
            snippet =>
              snippet.folderId !== null
              && removedFolderIds.has(snippet.folderId),
          )
          .map(snippet => snippet.filePath),
      )
      assertNoUnknownDomainFiles(
        paths.vaultPath,
        topFolderPath ? [topFolderPath] : [],
        knownFilePaths,
      )

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
            skipWriteIfUnavailable: true,
          })
        }
      })

      state.folders = state.folders.filter(
        folder => !removedFolderIds.has(folder.id),
      )

      removeFolderPathsFromDisk(paths.vaultPath, removedFolderPaths)

      saveState(paths, state)
      scheduleDockBadgeRefresh()

      return { deleted: true }
    },
  }
}
