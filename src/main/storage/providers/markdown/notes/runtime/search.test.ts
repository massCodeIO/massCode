import type { MarkdownNote, NotesRuntimeCache, NotesState } from './types'
import { afterEach, describe, expect, it } from 'vitest'
import { notesRuntimeRef } from './constants'
import { buildNotesSearchIndex, getNoteIdsBySearchQuery } from './search'

function createState(notes: MarkdownNote[]): NotesState {
  return {
    counters: {
      folderId: 0,
      noteId: notes.length,
      tagId: 0,
    },
    folderUi: {},
    folders: [],
    notes: notes.map(note => ({ filePath: note.filePath, id: note.id })),
    tags: [],
    version: 1,
  }
}

function createNote(id: number, name: string): MarkdownNote {
  const now = Date.now()

  return {
    content: '',
    createdAt: now,
    description: null,
    filePath: `${name}.md`,
    folderId: null,
    id,
    isDeleted: 0,
    isFavorites: 0,
    name,
    tags: [],
    updatedAt: now,
  }
}

function createRuntimeCache(notes: MarkdownNote[]): NotesRuntimeCache {
  const state = createState(notes)
  const searchIndex = buildNotesSearchIndex(notes)

  return {
    folderById: new Map(),
    noteById: new Map(notes.map(note => [note.id, note])),
    notes,
    paths: {
      inboxDirPath: '/tmp/inbox',
      metaDirPath: '/tmp/meta',
      notesRoot: '/tmp/notes',
      statePath: '/tmp/state.json',
      trashDirPath: '/tmp/trash',
    },
    searchIndexDirty: false,
    searchNoteTextById: searchIndex.searchNoteTextById,
    searchQueryCache: new Map(),
    searchTokenToNoteIds: searchIndex.searchTokenToNoteIds,
    searchTokensByNoteId: searchIndex.searchTokensByNoteId,
    state,
  }
}

afterEach(() => {
  notesRuntimeRef.cache = null
})

describe('getNoteIdsBySearchQuery', () => {
  it('finds notes for one-character query when runtime index is used', () => {
    const notes = [createNote(1, 'Alpha'), createNote(2, 'Beta')]
    notesRuntimeRef.cache = createRuntimeCache(notes)

    expect(getNoteIdsBySearchQuery(notes, 'a')).toEqual([1, 2])
  })
})
