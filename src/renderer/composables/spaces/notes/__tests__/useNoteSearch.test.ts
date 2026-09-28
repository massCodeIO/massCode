import { describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'

globalThis.computed = computed
globalThis.ref = ref
globalThis.shallowRef = shallowRef

describe('useNoteSearch', () => {
  it('discards the previous vault search and snapshot before clearing search in the new vault', async () => {
    vi.resetModules()

    const notesState = { noteId: 1, folderId: 10 }
    const stateSnapshots = { beforeSearch: {} }
    const notes = ref([{ id: 1 }])
    const isRestoreStateBlocked = ref(false)
    const saveNotesStateSnapshot = vi.fn(() => {
      stateSnapshots.beforeSearch = { ...notesState }
    })
    const restoreNotesStateSnapshot = vi.fn(() => {
      Object.assign(notesState, stateSnapshots.beforeSearch)
    })

    vi.doMock('../useNotesApp', () => ({
      useNotesApp: () => ({
        saveNotesStateSnapshot,
        restoreNotesStateSnapshot,
        stateSnapshots,
      }),
    }))
    vi.doMock('../useNotes', () => ({
      getNotes: vi.fn(),
      isRestoreStateBlocked,
      notes,
      selectFirstNote: vi.fn(),
      selectNote: vi.fn(),
    }))

    const { useNoteSearch, notesBySearch } = await import('../useNoteSearch')
    const search = useNoteSearch()
    search.searchQuery.value = 'old vault'
    await search.search()
    notesBySearch.value = [{ id: 1 }]

    search.resetNoteSearchState()
    Object.assign(notesState, { noteId: 2, folderId: 20 })
    notes.value = [{ id: 2 }]
    search.clearSearch(true)

    expect(search.searchQuery.value).toBe('')
    expect(search.isSearch.value).toBe(false)
    expect(search.searchSelectedIndex.value).toBe(-1)
    expect(notesBySearch.value).toBeUndefined()
    expect(search.displayedNotes.value).toEqual([{ id: 2 }])
    expect(notesState).toEqual({ noteId: 2, folderId: 20 })

    search.searchQuery.value = 'new vault'
    await search.search()
    notesState.noteId = 3
    search.clearSearch(true)
    expect(notesState.noteId).toBe(2)
  })
})
