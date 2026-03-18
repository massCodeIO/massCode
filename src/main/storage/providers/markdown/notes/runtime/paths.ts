import type { NotesFolderRecord, NotesState } from './types'
import {
  buildFolderPathMap as buildFolderPathMapShared,
  buildPathToFolderIdMap as buildPathToFolderIdMapShared,
  getFolderSiblings as getFolderSiblingsShared,
  getNextFolderOrder as getNextFolderOrderShared,
} from '../../runtime/shared/folderIndex'
import { notesRuntimeRef } from './constants'

export function buildNotesFolderPathMap(
  state: NotesState,
): Map<number, string> {
  return buildFolderPathMapShared(state.folders)
}

export function buildPathToNotesFolderIdMap(
  state: NotesState,
): Map<string, number> {
  return buildPathToFolderIdMapShared(state.folders)
}

export function findNotesFolderById(
  state: NotesState,
  folderId: number,
): NotesFolderRecord | undefined {
  const cache = notesRuntimeRef.cache
  const runtimeCache = cache?.state === state ? cache : null

  if (runtimeCache) {
    if (runtimeCache.folderById.size !== state.folders.length) {
      runtimeCache.folderById = new Map(
        state.folders.map(folder => [folder.id, folder]),
      )
    }

    const folderFromIndex = runtimeCache.folderById.get(folderId)
    if (folderFromIndex) {
      return folderFromIndex
    }
  }

  const folder = state.folders.find(item => item.id === folderId)
  if (folder && runtimeCache) {
    runtimeCache.folderById.set(folderId, folder)
  }

  return folder
}

export function getNotesFolderPathById(
  state: NotesState,
  folderId: number,
): string | null {
  const folderPathMap = buildNotesFolderPathMap(state)
  return folderPathMap.get(folderId) || null
}

export function getNotesFolderSiblings(
  state: NotesState,
  parentId: number | null,
  excludeId?: number,
): NotesFolderRecord[] {
  return getFolderSiblingsShared(state.folders, parentId, excludeId)
}

export function getNextNotesFolderOrder(
  state: NotesState,
  parentId: number | null,
): number {
  return getNextFolderOrderShared(state.folders, parentId)
}
