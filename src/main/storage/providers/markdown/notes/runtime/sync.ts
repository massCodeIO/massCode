import type {
  MarkdownNote,
  NotesFolderMetadataFile,
  NotesFolderRecord,
  NotesPaths,
  NotesRuntimeCache,
  NotesState,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import {
  syncFolderMetadataFilesByPathMap,
  syncFoldersStateFromDiskAtRoot,
} from '../../runtime/shared/folderSync'
import { normalizeDirectoryPath, toPosixPath } from '../../runtime/shared/path'
import {
  NOTES_INBOX_RELATIVE_PATH,
  NOTES_TRASH_RELATIVE_PATH,
  notesRuntimeRef,
} from './constants'
import { listNoteMarkdownFiles, loadNotes, readNoteFromFile } from './notes'
import {
  readNotesFolderMetadata,
  writeNotesFolderMetadataFile,
} from './parser'
import { buildNotesFolderPathMap, buildPathToNotesFolderIdMap } from './paths'
import { buildNoteSearchText, buildSearchIndex } from './search'
import {
  flushPendingNotesStateWrite,
  loadNotesState,
  saveNotesState,
} from './state'

export function syncNotesFoldersWithDisk(
  paths: NotesPaths,
  state: NotesState,
): void {
  syncFoldersStateFromDiskAtRoot<NotesFolderRecord, NotesFolderMetadataFile>({
    buildFolder: ({ base, metadata, previousFolder }) => ({
      ...base,
      icon:
        metadata.icon === null
          ? null
          : typeof metadata.icon === 'string'
            ? metadata.icon
            : (previousFolder?.icon ?? null),
    }),
    readMetadata: relativePath =>
      readNotesFolderMetadata(paths, relativePath),
    rootPath: paths.notesRoot,
    shouldSkipDirectory: ({ entryName }) => entryName.startsWith('.'),
    state,
  })
}

function readNoteIdFromFrontmatter(absolutePath: string): number | null {
  try {
    const source = fs.readFileSync(absolutePath, 'utf8')
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) {
      return null
    }

    const fm = yaml.load(match[1]) as { id?: unknown } | null
    return fm && typeof fm.id === 'number' && fm.id ? fm.id : null
  }
  catch {
    return null
  }
}

export function syncNotesWithDisk(paths: NotesPaths, state: NotesState): void {
  const mdFiles = listNoteMarkdownFiles(paths.notesRoot)

  // Build existing path -> id map from state
  const existingByPath = new Map<string, number>()
  state.notes.forEach(entry => existingByPath.set(entry.filePath, entry.id))

  const nextNotes: { id: number, filePath: string }[] = []
  const usedIds = new Set<number>()

  for (const filePath of mdFiles) {
    let noteId = existingByPath.get(filePath)

    if (!noteId || usedIds.has(noteId)) {
      // Try reading frontmatter for id
      const frontmatterId = readNoteIdFromFrontmatter(
        path.join(paths.notesRoot, filePath),
      )
      if (frontmatterId && !usedIds.has(frontmatterId)) {
        noteId = frontmatterId
      }
    }

    if (!noteId || usedIds.has(noteId)) {
      state.counters.noteId += 1
      noteId = state.counters.noteId
    }

    usedIds.add(noteId)
    nextNotes.push({ id: noteId, filePath })
  }

  state.notes = nextNotes
}

function syncNotesCounters(state: NotesState): void {
  let maxFolderId = state.counters.folderId
  let maxNoteId = state.counters.noteId
  let maxTagId = state.counters.tagId

  for (const folder of state.folders) {
    if (folder.id > maxFolderId) {
      maxFolderId = folder.id
    }
  }

  for (const note of state.notes) {
    if (note.id > maxNoteId) {
      maxNoteId = note.id
    }
  }

  for (const tag of state.tags) {
    if (tag.id > maxTagId) {
      maxTagId = tag.id
    }
  }

  state.counters.folderId = maxFolderId
  state.counters.noteId = maxNoteId
  state.counters.tagId = maxTagId
}

export function syncNotesFolderMetadataFiles(
  paths: NotesPaths,
  state: NotesState,
): void {
  const folderPathMap = buildNotesFolderPathMap(state)
  syncFolderMetadataFilesByPathMap(
    state.folders,
    folderPathMap,
    (folderPath, folder) =>
      writeNotesFolderMetadataFile(paths, folderPath, folder),
  )
}

function setNotesRuntimeCache(
  paths: NotesPaths,
  state: NotesState,
  notes: MarkdownNote[],
): NotesRuntimeCache {
  const folderById = new Map(state.folders.map(f => [f.id, f]))
  const noteById = new Map(notes.map(n => [n.id, n]))

  const cache: NotesRuntimeCache = {
    folderById,
    noteById,
    notes,
    paths,
    searchIndex: buildSearchIndex(notes, buildNoteSearchText),
    state,
  }

  notesRuntimeRef.cache = cache
  return cache
}

export function syncNotesRuntimeWithDisk(paths: NotesPaths): NotesRuntimeCache {
  flushPendingNotesStateWrite(paths)
  const state = loadNotesState(paths)

  syncNotesFoldersWithDisk(paths, state)
  syncNotesWithDisk(paths, state)
  syncNotesCounters(state)

  saveNotesState(paths, state, { immediate: true })
  syncNotesFolderMetadataFiles(paths, state)

  const notes = loadNotes(paths, state)

  return setNotesRuntimeCache(paths, state, notes)
}

export function getNotesRuntimeCache(paths: NotesPaths): NotesRuntimeCache {
  if (
    notesRuntimeRef.cache
    && notesRuntimeRef.cache.paths.notesRoot === paths.notesRoot
  ) {
    return notesRuntimeRef.cache
  }

  return syncNotesRuntimeWithDisk(paths)
}

export function resetNotesRuntimeCache(): void {
  notesRuntimeRef.cache = null
}

function commitNotesRuntimeCache(cache: NotesRuntimeCache): NotesRuntimeCache {
  // A new object identity signals watcher consumers that data changed,
  // while built maps and the lazily rebuilt search index are reused.
  notesRuntimeRef.cache = { ...cache }
  return notesRuntimeRef.cache
}

function isTechnicalNotesDirectory(directoryPath: string): boolean {
  return (
    directoryPath === NOTES_INBOX_RELATIVE_PATH
    || directoryPath.startsWith(`${NOTES_INBOX_RELATIVE_PATH}/`)
    || directoryPath === NOTES_TRASH_RELATIVE_PATH
    || directoryPath.startsWith(`${NOTES_TRASH_RELATIVE_PATH}/`)
  )
}

export function syncNoteFileWithDisk(
  paths: NotesPaths,
  changedFilePath: string,
): NotesRuntimeCache | null {
  const cache = notesRuntimeRef.cache
  if (!cache || cache.paths.notesRoot !== paths.notesRoot) {
    return null
  }

  const normalizedFilePath = toPosixPath(changedFilePath).trim()
  if (
    !normalizedFilePath
    || path.posix.extname(normalizedFilePath).toLowerCase() !== '.md'
  ) {
    return null
  }

  const state = cache.state
  const notes = cache.notes
  const noteAbsolutePath = path.join(paths.notesRoot, normalizedFilePath)
  const normalizedDirectory = normalizeDirectoryPath(
    path.posix.dirname(normalizedFilePath),
  )
  const pathToFolderIdMap = buildPathToNotesFolderIdMap(state)

  if (
    normalizedDirectory
    && !isTechnicalNotesDirectory(normalizedDirectory)
    && !pathToFolderIdMap.has(normalizedDirectory)
  ) {
    return null
  }

  const normalizedFilePathKey = normalizedFilePath.toLowerCase()
  const noteIndexInState = state.notes.findIndex(
    entry => entry.filePath.toLowerCase() === normalizedFilePathKey,
  )
  const noteExistsOnDisk = fs.pathExistsSync(noteAbsolutePath)

  if (!noteExistsOnDisk) {
    if (noteIndexInState === -1) {
      return cache
    }

    const removedNoteId = state.notes[noteIndexInState].id
    state.notes.splice(noteIndexInState, 1)

    const noteIndexInRuntime = notes.findIndex(
      note => note.id === removedNoteId,
    )
    if (noteIndexInRuntime !== -1) {
      notes.splice(noteIndexInRuntime, 1)
    }
    cache.noteById.delete(removedNoteId)

    saveNotesState(paths, state)
    return commitNotesRuntimeCache(cache)
  }

  let noteIndexItem
    = noteIndexInState !== -1 ? state.notes[noteIndexInState] : null

  if (!noteIndexItem) {
    const existingNoteIds = new Set<number>(
      state.notes.map(entry => entry.id),
    )
    let noteId = readNoteIdFromFrontmatter(noteAbsolutePath)

    if (!noteId || existingNoteIds.has(noteId)) {
      state.counters.noteId += 1
      noteId = state.counters.noteId
    }

    noteIndexItem = { filePath: normalizedFilePath, id: noteId }
    state.notes.push(noteIndexItem)
  }
  else {
    noteIndexItem.filePath = normalizedFilePath
  }

  const syncedNote = readNoteFromFile(paths, noteIndexItem, pathToFolderIdMap)
  if (!syncedNote) {
    return null
  }

  const noteIndexInRuntime = notes.findIndex(
    note => note.id === syncedNote.id,
  )
  if (noteIndexInRuntime === -1) {
    notes.push(syncedNote)
  }
  else {
    notes[noteIndexInRuntime] = syncedNote
  }
  cache.noteById.set(syncedNote.id, syncedNote)

  if (syncedNote.id > state.counters.noteId) {
    state.counters.noteId = syncedNote.id
  }

  // saveNotesState marks the notes search index dirty, so it is rebuilt
  // lazily on the next search instead of eagerly on every file change.
  saveNotesState(paths, state)
  return commitNotesRuntimeCache(cache)
}
