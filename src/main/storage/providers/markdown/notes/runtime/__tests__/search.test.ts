import type { MarkdownNote, NotesRuntimeCache, NotesState } from '../types'
import { afterEach, describe, expect, it } from 'vitest'
import { buildSearchIndex } from '../../../runtime/shared/searchEngine'
import { notesRuntimeRef } from '../constants'
import {
  buildNoteSearchText,
  getNoteIdsBySearchQuery,
  invalidateNotesSearchIndex,
} from '../search'

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
    searchIndex: buildSearchIndex(notes, buildNoteSearchText),
    state,
  }
}

afterEach(() => {
  notesRuntimeRef.cache = null
})

describe('getNoteIdsBySearchQuery', () => {
  it('finds by short query (1 char) via substring match', () => {
    const notes = [createNote(1, 'Alpha'), createNote(2, 'Beta')]
    notesRuntimeRef.cache = createRuntimeCache(notes)

    const result = getNoteIdsBySearchQuery(notes, 'a')
    expect(result).toEqual(new Set([1, 2]))
  })

  it('does not use runtime cache when notes array differs from cached one', () => {
    const allNotes = [createNote(1, 'Alpha'), createNote(2, 'Beta')]
    const subsetNotes = [allNotes[0]]
    notesRuntimeRef.cache = createRuntimeCache(allNotes)

    expect(getNoteIdsBySearchQuery(subsetNotes, 'beta')).toEqual(new Set())
  })

  it('rebuild clears stale query cache when search index is dirty', () => {
    const notes = [createNote(1, 'Alpha')]
    const cache = createRuntimeCache(notes)
    cache.searchIndex.dirty = true
    cache.searchIndex.queryCache.set('alpha', [999])
    notesRuntimeRef.cache = cache

    expect(getNoteIdsBySearchQuery(notes, 'alpha')).toEqual(new Set([1]))
  })

  it('short standalone words participate in narrowing candidates', () => {
    const notes = [
      { ...createNote(1, 'Note'), content: 'an ox runs' },
      { ...createNote(2, 'Note'), content: 'a cat runs' },
    ]
    notesRuntimeRef.cache = createRuntimeCache(notes)

    expect(getNoteIdsBySearchQuery(notes, 'ox')).toEqual(new Set([1]))
  })

  it('handles nullish search query without throwing', () => {
    const notes = [createNote(1, 'Alpha'), createNote(2, 'Beta')]
    notesRuntimeRef.cache = createRuntimeCache(notes)

    expect(
      getNoteIdsBySearchQuery(notes, undefined as unknown as string),
    ).toEqual(new Set([1, 2]))
    expect(getNoteIdsBySearchQuery(notes, null as unknown as string)).toEqual(
      new Set([1, 2]),
    )
  })
})

describe('invalidateNotesSearchIndex', () => {
  it('invalidates cache only for matching runtime state', () => {
    const notes = [createNote(1, 'Alpha')]
    const cache = createRuntimeCache(notes)
    cache.searchIndex.dirty = false
    cache.searchIndex.queryCache.set('alpha', [1])
    notesRuntimeRef.cache = cache

    const unrelatedState = createState([])
    invalidateNotesSearchIndex(unrelatedState)

    expect(cache.searchIndex.dirty).toBe(false)
    expect(cache.searchIndex.queryCache.get('alpha')).toEqual([1])
  })
})
