import type {
  NoteFolderCreateInput,
  NoteFolderUpdateInput,
  NoteFolderUpdateResult,
  NotesFoldersStorage,
} from '../../../../contracts'
import path from 'node:path'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
import {
  assertEntityFileWritable,
  throwCloudContentUnavailable,
} from '../../runtime/shared/cloudGuards'
import { collectDescendantIds } from '../../runtime/shared/folderIndex'
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
import { rewriteBacklinksAfterFolderUpdate } from '../runtime/backlinks'
import {
  getNotesPaths,
  META_DIR_NAME,
  NOTES_RESERVED_ROOT_NAMES,
} from '../runtime/constants'
import { ensureNoteContentLoaded, persistNote } from '../runtime/notes'
import { writeNotesFolderMetadataFile } from '../runtime/parser'
import {
  buildNotesFolderPathMap,
  findNotesFolderById,
  getNextNotesFolderOrder,
} from '../runtime/paths'
import { saveNotesState } from '../runtime/state'
import {
  getNotesRuntimeCache,
  isNotesVaultDiskReady,
  syncNotesFolderMetadataFiles,
} from '../runtime/sync'

function assertNotReservedRootName(
  parentId: number | null,
  name: string,
): void {
  const normalizedName = name.toLowerCase()

  if (normalizedName === META_DIR_NAME) {
    throwStorageError('RESERVED_NAME', 'This folder name is reserved')
  }

  if (parentId === null && NOTES_RESERVED_ROOT_NAMES.has(normalizedName)) {
    throwStorageError(
      'RESERVED_NAME',
      'This folder name is reserved for technical folder',
    )
  }
}

export function createNotesFoldersStorage(): NotesFoldersStorage {
  function resolvePaths() {
    return getNotesPaths(getVaultPath())
  }

  function getCache() {
    return getNotesRuntimeCache(resolvePaths())
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

    createFolder(input: NoteFolderCreateInput) {
      const paths = resolvePaths()
      const { state } = getNotesRuntimeCache(paths)

      const name = validateEntryName(input.name, 'folder')
      const parentId = input.parentId ?? null

      assertNotReservedRootName(parentId, name)
      assertUniqueSiblingFolderName(state, parentId, name)

      if (parentId !== null) {
        const parent = findNotesFolderById(state, parentId)
        if (!parent) {
          throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
        }
      }

      const {
        folder,
        folderRelativePath,
        id: folderId,
      } = createFolderInStateAndDisk({
        buildFolderPathMap: buildNotesFolderPathMap,
        createFolder: ({ id, name, now, orderIndex, parentId }) => ({
          createdAt: now,
          icon: null,
          id,
          isOpen: 0,
          name,
          orderIndex,
          parentId,
          updatedAt: now,
        }),
        getNextFolderOrder: getNextNotesFolderOrder,
        name,
        parentId,
        rootPath: paths.notesRoot,
        state,
      })
      writeNotesFolderMetadataFile(paths, folderRelativePath, folder)
      saveNotesState(paths, state)

      return { id: folderId }
    },

    updateFolder(
      id: number,
      input: NoteFolderUpdateInput,
    ): NoteFolderUpdateResult {
      const paths = resolvePaths()

      // Rename/move каталога до завершения фоновой сверки работал бы по
      // пустому provisional-списку заметок: файлы переместились бы на диске,
      // а index paths и backlinks остались бы старыми.
      if (
        (input.name !== undefined || input.parentId !== undefined)
        && !isNotesVaultDiskReady(paths)
      ) {
        throwStorageError(
          'VAULT_HYDRATING',
          'Vault is still syncing, folder rename or move is not available yet',
        )
      }

      const { state, notes } = getNotesRuntimeCache(paths)
      const folder = findNotesFolderById(state, id)

      if (!folder) {
        return { invalidInput: false, notFound: true }
      }

      if (
        input.name === undefined
        && input.parentId === undefined
        && input.icon === undefined
        && input.isOpen === undefined
        && input.orderIndex === undefined
      ) {
        return { invalidInput: true, notFound: false }
      }

      const now = Date.now()
      let pathChanged = false

      const oldFolderPathMap = buildNotesFolderPathMap(state)
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

      assertNotReservedRootName(targetParentId, targetName)

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

      if (input.icon !== undefined) {
        folder.icon = input.icon ?? null
      }

      if (input.isOpen !== undefined) {
        folder.isOpen = normalizeFlag(input.isOpen)
      }

      folder.updatedAt = now

      if (pathChanged) {
        const newFolderPathMap = buildNotesFolderPathMap(state)
        const newPath = newFolderPathMap.get(id)

        if (oldPath && newPath && oldPath !== newPath) {
          const targetParentPath = path.posix.dirname(newPath)
          assertDirectoryNameAvailableAtRoot(
            paths.notesRoot,
            targetParentPath === '.' ? '' : targetParentPath,
            path.posix.basename(newPath),
            oldPath,
          )

          moveFolderDirectoryOnDisk(paths.notesRoot, oldPath, newPath)

          updateChildEntityPaths({
            entries: notes,
            getNextPath: (_, previousPath) =>
              replaceSubtreePathPrefix(previousPath, oldPath, newPath),
            onPathUpdated: (note, _previousPath, nextPath) => {
              const indexEntry = state.notes.find(n => n.id === note.id)
              if (indexEntry) {
                indexEntry.filePath = nextPath
              }
            },
          })

          rewriteBacklinksAfterFolderUpdate({
            newFolderPathMap,
            notes,
            oldFolderPathMap,
            paths,
            state,
          })
        }
      }

      syncNotesFolderMetadataFiles(paths, state)
      saveNotesState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    deleteFolder(id: number) {
      const paths = resolvePaths()

      // До завершения фоновой сверки runtime-кэш provisional: список заметок
      // пуст, перенос содержимого папки в trash ничего бы не нашёл, а
      // removeFolderPathsFromDisk физически уничтожил бы файлы на диске.
      if (!isNotesVaultDiskReady(paths)) {
        throwStorageError(
          'VAULT_HYDRATING',
          'Vault is still syncing, folder deletion is not available yet',
        )
      }

      const { state, notes } = getNotesRuntimeCache(paths)
      const folder = findNotesFolderById(state, id)

      if (!folder) {
        return { deleted: false }
      }

      const descendantIds = collectDescendantIds(state.folders, id)
      descendantIds.add(id)

      // Trash-маркер заметки — frontmatter isDeleted, а не путь: перенос
      // недокачанного файла без перезаписи frontmatter «воскресил» бы заметку
      // после докачки. Preflight выполняется до первой мутации в две фазы:
      // сначала eager-дочитка всех тел, затем свежий stat всех файлов (флаг
      // pendingCloudDownload мог устареть после eviction) — так окно между
      // проверкой и мутацией не растягивается на гидрацию соседей.
      const affectedNotes = notes.filter(
        note => note.folderId !== null && descendantIds.has(note.folderId),
      )
      for (const note of affectedNotes) {
        if (!ensureNoteContentLoaded(paths, note)) {
          throwCloudContentUnavailable()
        }
      }

      const folderPathMap = buildNotesFolderPathMap(state)
      const directoryEntriesCache = new Map<string, string[]>()

      // Доменный .md без записи в runtime (плейсхолдер с другого устройства,
      // сбой чтения при скане) физически уничтожился бы вместе с каталогом:
      // удаление отклоняется целиком. Обход стартует с корня удаляемой папки
      // и идёт до финальной stat-фазы, чтобы не расширять окно до мутации.
      const topFolderPath = folderPathMap.get(id)
      assertNoUnknownDomainFiles(
        paths.notesRoot,
        topFolderPath ? [topFolderPath] : [],
        new Set(affectedNotes.map(note => note.filePath)),
      )

      for (const note of affectedNotes) {
        assertEntityFileWritable(
          path.join(paths.notesRoot, note.filePath),
          note,
        )
      }

      for (const note of notes) {
        if (note.folderId !== null && descendantIds.has(note.folderId)) {
          const previousFilePath = note.filePath
          note.folderId = null
          note.isDeleted = 1
          note.updatedAt = Date.now()
          persistNote(paths, state, note, previousFilePath, {
            allowRenameOnConflict: true,
            directoryEntriesCache,
            folderPathMap,
          })
        }
      }

      const folderPathsToDelete = getFolderPathsByDepth(
        folderPathMap,
        descendantIds,
      )

      removeFolderPathsFromDisk(paths.notesRoot, folderPathsToDelete, {
        ignoreErrors: true,
      })

      state.folders = state.folders.filter(f => !descendantIds.has(f.id))
      saveNotesState(paths, state)

      return { deleted: true }
    },
  }
}
