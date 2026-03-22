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
import { notesRuntimeRef } from './constants'
import { listNoteMarkdownFiles, loadNotes } from './notes'
import {
  readNotesFolderMetadata,
  writeNotesFolderMetadataFile,
} from './parser'
import { buildNotesFolderPathMap } from './paths'
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
      const absolutePath = path.join(paths.notesRoot, filePath)
      try {
        const source = fs.readFileSync(absolutePath, 'utf8')
        const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
        if (match) {
          const fm = yaml.load(match[1]) as any
          if (fm?.id && typeof fm.id === 'number' && !usedIds.has(fm.id)) {
            noteId = fm.id
          }
        }
      }
      catch {
        // ignore
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
