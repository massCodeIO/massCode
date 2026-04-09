import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'

globalThis.computed = computed
globalThis.reactive = reactive
globalThis.ref = ref

interface FolderNode {
  id: number
  children: FolderNode[]
}

interface SetupOptions {
  displayedNoteIds?: number[]
  folderId?: number
  folders?: FolderNode[]
  noteId?: number
  tagId?: number
  tags?: Array<{ id: number, name: string }>
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const notesState = reactive<{
    folderId?: number
    libraryFilter?: string
    noteId?: number
    tagId?: number
  }>({
    folderId: options.folderId,
    noteId: options.noteId,
    tagId: options.tagId,
  })

  const folders = ref<FolderNode[] | undefined>(
    options.folders ?? [
      { id: 11, children: [] },
      { id: 12, children: [] },
    ],
  )
  const tags = ref(options.tags ?? [{ id: 1, name: 'docs' }])
  const displayedNotes = ref(
    (options.displayedNoteIds ?? []).map(id => ({ id })),
  )

  const getNotes = vi.fn(async () => undefined)
  const selectFirstNote = vi.fn(() => {
    notesState.noteId = displayedNotes.value[0]?.id
  })

  vi.doMock('../useNotesApp', () => ({
    useNotesApp: () => ({
      notesState,
    }),
  }))

  vi.doMock('../useNoteFolders', () => ({
    useNoteFolders: () => ({
      folders,
    }),
  }))

  vi.doMock('../useNoteTags', () => ({
    useNoteTags: () => ({
      tags,
    }),
  }))

  vi.doMock('../useNotes', () => ({
    useNotes: () => ({
      getNotes,
      selectFirstNote,
    }),
  }))

  vi.doMock('../useNoteSearch', () => ({
    useNoteSearch: () => ({
      displayedNotes,
    }),
  }))

  const { normalizeNotesSelectionState } = await import(
    '../useNotesSelectionNormalization'
  )

  return {
    getNotes,
    normalizeNotesSelectionState,
    notesState,
    selectFirstNote,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeNotesSelectionState', () => {
  it('clears stale tagId before requesting notes', async () => {
    const context = await setup({
      folderId: 11,
      tagId: 999,
    })

    await context.normalizeNotesSelectionState()

    expect(context.notesState.tagId).toBeUndefined()
    expect(context.getNotes).toHaveBeenCalledTimes(1)
  })

  it('falls back to the first folder when saved notes folderId is missing', async () => {
    const context = await setup({
      folderId: 999,
      folders: [
        { id: 11, children: [] },
        { id: 12, children: [] },
      ],
    })

    await context.normalizeNotesSelectionState()

    expect(context.notesState.folderId).toBe(11)
    expect(context.getNotes).toHaveBeenCalledTimes(1)
  })

  it('selects the first note when saved noteId is absent from the list', async () => {
    const context = await setup({
      displayedNoteIds: [3, 4],
      folderId: 11,
      noteId: 99,
    })

    await context.normalizeNotesSelectionState()

    expect(context.selectFirstNote).toHaveBeenCalledTimes(1)
    expect(context.notesState.noteId).toBe(3)
  })
})
