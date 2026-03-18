import type {
  NoteFolderCreateInput,
  NoteFolderUpdateInput,
  NoteFolderUpdateResult,
  NotesFoldersStorage,
} from '../../../../contracts'
import type { NotesFolderRecord, NotesState } from '../runtime/types'
import path from 'node:path'
import fs from 'fs-extra'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
import {
  buildFolderTree,
  collectDescendantIds,
  sortFoldersForTree,
} from '../../runtime/shared/folderIndex'
import { throwStorageError, validateEntryName } from '../../runtime/validation'
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
  getNotesFolderSiblings,
} from '../runtime/paths'
import { saveNotesState } from '../runtime/state'
import { getNotesRuntimeCache } from '../runtime/sync'

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

function assertUniqueSiblingName(
  state: NotesState,
  parentId: number | null,
  name: string,
  excludeId?: number,
): void {
  const normalizedName = name.toLowerCase()
  const hasConflict = getNotesFolderSiblings(state, parentId, excludeId).some(
    folder => folder.name.toLowerCase() === normalizedName,
  )

  if (hasConflict) {
    throwStorageError(
      'NAME_CONFLICT',
      'Folder with this name already exists on this level',
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
      return [...state.folders].sort((a, b) => b.createdAt - a.createdAt)
    },

    getFoldersTree() {
      const { state } = getCache()
      return buildFolderTree(sortFoldersForTree([...state.folders]))
    },

    createFolder(input: NoteFolderCreateInput) {
      const paths = resolvePaths()
      const { state } = getNotesRuntimeCache(paths)

      const name = validateEntryName(input.name, 'folder')
      const parentId = input.parentId ?? null

      assertNotReservedRootName(parentId, name)
      assertUniqueSiblingName(state, parentId, name)

      if (parentId !== null) {
        const parent = findNotesFolderById(state, parentId)
        if (!parent) {
          throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
        }
      }

      const folderPathMap = buildNotesFolderPathMap(state)
      const parentPath
        = parentId !== null ? folderPathMap.get(parentId) : undefined
      const folderRelativePath = parentPath
        ? path.posix.join(parentPath, name)
        : name
      const folderAbsPath = path.join(paths.notesRoot, folderRelativePath)
      fs.ensureDirSync(folderAbsPath)

      state.counters.folderId += 1
      const folderId = state.counters.folderId
      const now = Date.now()

      const folder: NotesFolderRecord = {
        createdAt: now,
        icon: null,
        id: folderId,
        isOpen: 0,
        name,
        orderIndex: getNextNotesFolderOrder(state, parentId),
        parentId,
        updatedAt: now,
      }

      state.folders.push(folder)
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
        assertUniqueSiblingName(state, parentId, name, id)

        if (name !== folder.name) {
          pathChanged = true
        }

        folder.name = name
      }

      if (input.parentId !== undefined) {
        const newParentId = input.parentId ?? null

        if (newParentId !== null) {
          const parent = findNotesFolderById(state, newParentId)
          if (!parent) {
            throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
          }

          const descendants = collectDescendantIds(state.folders, id)
          if (descendants.has(newParentId)) {
            throwStorageError(
              'INVALID_NAME',
              'Folder cannot be moved into its own subtree',
            )
          }
        }

        if (newParentId !== folder.parentId) {
          if (input.name === undefined) {
            assertUniqueSiblingName(state, newParentId, folder.name, id)
          }

          pathChanged = true
          folder.parentId = newParentId
        }
      }

      if (input.icon !== undefined) {
        folder.icon = input.icon ?? null
      }

      if (input.isOpen !== undefined) {
        folder.isOpen = normalizeFlag(input.isOpen)
      }

      if (input.orderIndex !== undefined) {
        folder.orderIndex = normalizeNumber(
          input.orderIndex,
          folder.orderIndex,
        )
      }

      folder.updatedAt = now

      if (pathChanged) {
        const newFolderPathMap = buildNotesFolderPathMap(state)
        const newPath = newFolderPathMap.get(id)

        if (oldPath && newPath && oldPath !== newPath) {
          const oldAbsPath = path.join(paths.notesRoot, oldPath)
          const newAbsPath = path.join(paths.notesRoot, newPath)

          if (fs.pathExistsSync(oldAbsPath)) {
            fs.ensureDirSync(path.dirname(newAbsPath))
            fs.moveSync(oldAbsPath, newAbsPath)
          }

          for (const note of notes) {
            if (note.filePath.startsWith(`${oldPath}/`)) {
              const newFilePath = note.filePath.replace(oldPath, newPath)
              note.filePath = newFilePath

              const indexEntry = state.notes.find(n => n.id === note.id)
              if (indexEntry) {
                indexEntry.filePath = newFilePath
              }
            }
          }
        }

        const finalPath = newFolderPathMap.get(id)
        if (finalPath) {
          writeNotesFolderMetadataFile(paths, finalPath, folder)
        }
      }
      else {
        const folderPathMap = buildNotesFolderPathMap(state)
        const folderPath = folderPathMap.get(id)
        if (folderPath) {
          writeNotesFolderMetadataFile(paths, folderPath, folder)
        }
      }

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
      const foldersToDelete = state.folders
        .filter(f => descendantIds.has(f.id))
        .sort((a, b) => {
          const pathA = folderPathMap.get(a.id) || ''
          const pathB = folderPathMap.get(b.id) || ''
          return pathB.split('/').length - pathA.split('/').length
        })

      for (const f of foldersToDelete) {
        const folderPath = folderPathMap.get(f.id)
        if (folderPath) {
          const absPath = path.join(paths.notesRoot, folderPath)
          if (fs.pathExistsSync(absPath)) {
            try {
              fs.removeSync(absPath)
            }
            catch {
              // Non-critical
            }
          }
        }
      }

      state.folders = state.folders.filter(f => !descendantIds.has(f.id))
      saveNotesState(paths, state)

      return { deleted: true }
    },
  }
}
