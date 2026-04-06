import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

async function setup() {
  vi.resetModules()

  const push = vi.fn(async () => undefined)
  const clearSearch = vi.fn()
  const getNotes = vi.fn(async () => undefined)
  const selectFirstNote = vi.fn()
  const selectNote = vi.fn()
  const getNotesById = vi.fn()

  const notesState = reactive<{
    noteId?: number
    folderId?: number
    tagId?: number
    libraryFilter?: string
  }>({})

  vi.doMock('@/router', () => ({
    RouterName: {
      notesSpace: 'notes-space',
    },
    router: {
      push,
    },
  }))

  vi.doMock('../useNotesApp', () => ({
    useNotesApp: () => ({
      notesState,
    }),
  }))

  vi.doMock('../useNoteSearch', () => ({
    useNoteSearch: () => ({
      clearSearch,
      isSearch: ref(false),
    }),
  }))

  vi.doMock('../useNotes', () => ({
    useNotes: () => ({
      getNotes,
      selectFirstNote,
      selectNote,
    }),
  }))

  vi.doMock('@/services/api', () => ({
    api: {
      notes: {
        getNotesById,
      },
    },
  }))

  const module = await import('../useNotesWorkspaceNavigation')

  return {
    clearSearch,
    getNotes,
    getNotesById,
    notesState,
    openNoteInNotesWorkspace:
      module.useNotesWorkspaceNavigation().openNoteInNotesWorkspace,
    openTagInNotesWorkspace:
      module.useNotesWorkspaceNavigation().openTagInNotesWorkspace,
    push,
    selectFirstNote,
    selectNote,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNotesWorkspaceNavigation', () => {
  it('opens a folder note in the notes workspace and loads its folder list', async () => {
    const context = await setup()

    context.getNotesById.mockResolvedValue({
      data: {
        id: 42,
        folder: {
          id: 7,
          name: 'Docs',
        },
      },
    })

    await context.openNoteInNotesWorkspace(42)

    expect(context.push).toHaveBeenCalledWith({ name: 'notes-space' })
    expect(context.clearSearch).toHaveBeenCalledTimes(1)
    expect(context.notesState.tagId).toBeUndefined()
    expect(context.notesState.libraryFilter).toBeUndefined()
    expect(context.notesState.folderId).toBe(7)
    expect(context.getNotes).toHaveBeenCalledWith({ folderId: 7 })
    expect(context.selectNote).toHaveBeenCalledWith(42)
  })

  it('opens an inbox note in the notes workspace and loads inbox notes', async () => {
    const context = await setup()

    context.getNotesById.mockResolvedValue({
      data: {
        id: 42,
        folder: null,
      },
    })

    await context.openNoteInNotesWorkspace(42)

    expect(context.notesState.folderId).toBeUndefined()
    expect(context.notesState.libraryFilter).toBe('inbox')
    expect(context.getNotes).toHaveBeenCalledWith({ isInbox: 1 })
    expect(context.selectNote).toHaveBeenCalledWith(42)
  })

  it('opens a tag in the notes workspace and loads filtered notes', async () => {
    const context = await setup()

    context.notesState.folderId = 10
    context.notesState.libraryFilter = 'favorites'

    await context.openTagInNotesWorkspace(11)

    expect(context.push).toHaveBeenCalledWith({ name: 'notes-space' })
    expect(context.clearSearch).toHaveBeenCalledTimes(1)
    expect(context.notesState.folderId).toBeUndefined()
    expect(context.notesState.libraryFilter).toBeUndefined()
    expect(context.notesState.tagId).toBe(11)
    expect(context.getNotes).toHaveBeenCalledWith({ tagId: 11 })
    expect(context.selectFirstNote).toHaveBeenCalledTimes(1)
  })
})
