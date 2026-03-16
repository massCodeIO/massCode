import type {
  NoteFolderCreateInput,
  NoteFolderUpdateInput,
  NoteFolderUpdateResult,
  NotesFoldersStorage,
} from '../../../../contracts'
import type {
  NotesFolderRecord,
  NotesFolderTreeRecord,
  NotesState,
} from '../runtime/types'
import path from 'node:path'
import fs from 'fs-extra'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
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

function createFolderTree(
  folders: NotesFolderRecord[],
): NotesFolderTreeRecord[] {
  const childrenMap = new Map<number | null, NotesFolderTreeRecord[]>()

  for (const folder of folders) {
    const treeItem: NotesFolderTreeRecord = { ...folder, children: [] }
    const siblings = childrenMap.get(folder.parentId)
    if (siblings) {
      siblings.push(treeItem)
    }
    else {
      childrenMap.set(folder.parentId, [treeItem])
    }
  }

  function attachChildren(items: NotesFolderTreeRecord[]): void {
    for (const item of items) {
      const children = childrenMap.get(item.id)
      if (children) {
        children.sort((a, b) => a.orderIndex - b.orderIndex)
        item.children = children
        attachChildren(children)
      }
    }
  }

  const roots = childrenMap.get(null) || []
  roots.sort((a, b) => a.orderIndex - b.orderIndex)
  attachChildren(roots)

  return roots
}

function findDescendantIds(
  folders: NotesFolderRecord[],
  parentId: number,
): Set<number> {
  const descendantIds = new Set<number>()

  function collect(targetParentId: number): void {
    for (const folder of folders) {
      if (folder.parentId === targetParentId && !descendantIds.has(folder.id)) {
        descendantIds.add(folder.id)
        collect(folder.id)
      }
    }
  }

  collect(parentId)
  return descendantIds
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
      const sorted = [...state.folders].sort(
        (a, b) => a.orderIndex - b.orderIndex,
      )
      return createFolderTree(sorted)
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

          const descendants = findDescendantIds(state.folders, id)
          if (descendants.has(newParentId)) {
            throwStorageError(
              'INVALID_NAME',
              'Folder cannot be moved into its own subtree',
            )
          }
        }

        if (newParentId !== folder.parentId) {
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

      const descendantIds = findDescendantIds(state.folders, id)
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
