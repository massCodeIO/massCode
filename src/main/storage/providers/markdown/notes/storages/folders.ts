import type {
  NoteFolderCreateInput,
  NoteFolderUpdateInput,
  NoteFolderUpdateResult,
  NotesFoldersStorage,
} from '../../../../contracts'
import path from 'node:path'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
import { collectDescendantIds } from '../../runtime/shared/folderIndex'
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
  updateChildEntityPaths,
} from '../../runtime/shared/foldersStorage'
import {
  assertDirectoryNameAvailableAtRoot,
  assertUniqueSiblingFolderName,
  throwStorageError,
  validateEntryName,
} from '../../runtime/validation'
import {
  getNotesPaths,
  META_DIR_NAME,
  NOTES_RESERVED_ROOT_NAMES,
} from '../runtime/constants'
import { persistNote } from '../runtime/notes'
import { writeNotesFolderMetadataFile } from '../runtime/parser'
import {
  buildNotesFolderPathMap,
  findNotesFolderById,
  getNextNotesFolderOrder,
} from '../runtime/paths'
import { saveNotesState } from '../runtime/state'
import {
  getNotesRuntimeCache,
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

      if (input.name !== undefined) {
        const name = validateEntryName(input.name, 'folder')
        const parentId
          = input.parentId !== undefined
            ? (input.parentId ?? null)
            : folder.parentId

        assertNotReservedRootName(parentId, name)
        assertUniqueSiblingFolderName(state, parentId, name, id)

        if (name !== folder.name) {
          pathChanged = true
        }

        folder.name = name
      }

      const targetParentId
        = input.parentId !== undefined
          ? (input.parentId ?? null)
          : folder.parentId
      const targetOrderIndex
        = input.orderIndex !== undefined
          ? normalizeNumber(input.orderIndex, folder.orderIndex)
          : folder.orderIndex

      if (input.parentId !== undefined) {
        const newParentId = input.parentId ?? null

        assertFolderMoveTargetValid(state.folders, id, newParentId)

        if (newParentId !== folder.parentId && input.name === undefined) {
          assertUniqueSiblingFolderName(state, newParentId, folder.name, id)
        }
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
        }
      }

      syncNotesFolderMetadataFiles(paths, state)
      saveNotesState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    deleteFolder(id: number) {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const folder = findNotesFolderById(state, id)

      if (!folder) {
        return { deleted: false }
      }

      const descendantIds = collectDescendantIds(state.folders, id)
      descendantIds.add(id)

      for (const note of notes) {
        if (note.folderId !== null && descendantIds.has(note.folderId)) {
          const previousFilePath = note.filePath
          note.folderId = null
          note.isDeleted = 1
          note.updatedAt = Date.now()
          persistNote(paths, state, note, previousFilePath, {
            allowRenameOnConflict: true,
          })
        }
      }

      const folderPathMap = buildNotesFolderPathMap(state)
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
