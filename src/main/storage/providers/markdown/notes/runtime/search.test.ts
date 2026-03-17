import type { MarkdownNote, NotesRuntimeCache, NotesState } from './types'
import { afterEach, describe, expect, it } from 'vitest'
import { notesRuntimeRef } from './constants'
import {
  buildNotesSearchIndex,
  getNoteIdsBySearchQuery,
  invalidateNotesSearchIndex,
} from './search'

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

  it('does not use runtime cache when notes array differs from cached one', () => {
    const allNotes = [createNote(1, 'Alpha'), createNote(2, 'Beta')]
    const subsetNotes = [allNotes[0]]
    notesRuntimeRef.cache = createRuntimeCache(allNotes)

    expect(getNoteIdsBySearchQuery(subsetNotes, 'beta')).toEqual([])
  })

  it('rebuild clears stale query cache when search index is dirty', () => {
    const notes = [createNote(1, 'Alpha')]
    const cache = createRuntimeCache(notes)
    cache.searchIndexDirty = true
    cache.searchQueryCache.set('alpha', [999])
    notesRuntimeRef.cache = cache

    expect(getNoteIdsBySearchQuery(notes, 'alpha')).toEqual([1])
  })

  it('returns copy of cached query result to avoid cache mutation from outside', () => {
    const notes = [createNote(1, 'Alpha')]
    notesRuntimeRef.cache = createRuntimeCache(notes)

    const firstResult = getNoteIdsBySearchQuery(notes, 'alpha')
    firstResult.push(999)

    expect(getNoteIdsBySearchQuery(notes, 'alpha')).toEqual([1])
  })

  it('handles nullish search query without throwing', () => {
    const notes = [createNote(1, 'Alpha'), createNote(2, 'Beta')]
    notesRuntimeRef.cache = createRuntimeCache(notes)

    expect(
      getNoteIdsBySearchQuery(notes, undefined as unknown as string),
    ).toEqual([1, 2])
    expect(getNoteIdsBySearchQuery(notes, null as unknown as string)).toEqual([
      1,
      2,
    ])
  })
})

describe('invalidateNotesSearchIndex', () => {
  it('invalidates cache only for matching runtime state', () => {
    const notes = [createNote(1, 'Alpha')]
    const cache = createRuntimeCache(notes)
    cache.searchIndexDirty = false
    cache.searchQueryCache.set('alpha', [1])
    notesRuntimeRef.cache = cache

    const unrelatedState = createState([])
    invalidateNotesSearchIndex(unrelatedState)

    expect(cache.searchIndexDirty).toBe(false)
    expect(cache.searchQueryCache.get('alpha')).toEqual([1])
  })
})
