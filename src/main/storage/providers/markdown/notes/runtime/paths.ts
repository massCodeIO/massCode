import type { NotesFolderRecord, NotesState } from './types'
import path from 'node:path'
import { notesRuntimeRef } from './constants'

export function buildNotesFolderPathMap(
  state: NotesState,
): Map<number, string> {
  const folderById = new Map<number, NotesFolderRecord>()
  state.folders.forEach(folder => folderById.set(folder.id, folder))

  const resolvedMap = new Map<number, string>()
  const visiting = new Set<number>()

  const resolveFolderPath = (folderId: number): string => {
    const existingPath = resolvedMap.get(folderId)
    if (existingPath !== undefined) {
      return existingPath
    }

    const folder = folderById.get(folderId)
    if (!folder) {
      return ''
    }

    if (visiting.has(folderId)) {
      return folder.name
    }

    visiting.add(folderId)

    const parentPath
      = folder.parentId !== null ? resolveFolderPath(folder.parentId) : ''
    const currentPath = parentPath
      ? path.posix.join(parentPath, folder.name)
      : folder.name

    resolvedMap.set(folderId, currentPath)
    visiting.delete(folderId)

    return currentPath
  }

  state.folders.forEach(folder => resolveFolderPath(folder.id))

  return resolvedMap
}

export function buildPathToNotesFolderIdMap(
  state: NotesState,
): Map<string, number> {
  const folderPathMap = buildNotesFolderPathMap(state)
  const pathMap = new Map<string, number>()

  folderPathMap.forEach((folderPath, folderId) => {
    pathMap.set(folderPath, folderId)
  })

  return pathMap
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
  return state.folders.filter((folder) => {
    if (folder.parentId !== parentId) {
      return false
    }

    if (excludeId !== undefined && folder.id === excludeId) {
      return false
    }

    return true
  })
}

export function getNextNotesFolderOrder(
  state: NotesState,
  parentId: number | null,
): number {
  return (
    state.folders
      .filter(folder => folder.parentId === parentId)
      .reduce((maxOrder, folder) => Math.max(maxOrder, folder.orderIndex), -1)
      + 1
  )
}
