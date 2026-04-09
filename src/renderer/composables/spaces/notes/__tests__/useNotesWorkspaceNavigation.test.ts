import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

async function setup() {
  vi.resetModules()

  const currentRoute = ref({ name: 'notes-space' })
  const push = vi.fn(async ({ name }: { name: string }) => {
    currentRoute.value = { name }
  })
  const clearSearch = vi.fn()
  const getNotes = vi.fn(async () => undefined)
  const selectFirstNote = vi.fn()
  const selectNote = vi.fn()
  const getNotesById = vi.fn()
  const recordNavigation = vi.fn(async (navigate: () => Promise<void>) => {
    await navigate()
  })
  const isNavigatingHistory = ref(false)

  const notesState = reactive<{
    noteId?: number
    folderId?: number
    tagId?: number
    libraryFilter?: string
  }>({})

  vi.doMock('@/router', () => ({
    RouterName: {
      notesDashboard: 'notes-space/dashboard',
      notesGraph: 'notes-space/graph',
      notesSpace: 'notes-space',
    },
    router: {
      currentRoute,
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

  vi.doMock('@/composables/useNavigationHistory', () => ({
    useNavigationHistory: () => ({
      isNavigatingHistory,
      recordNavigation,
    }),
  }))

  const module = await import('../useNotesWorkspaceNavigation')

  return {
    clearSearch,
    getNotes,
    getNotesById,
    currentRoute,
    notesState,
    openNoteFromGraph: module.useNotesWorkspaceNavigation().openNoteFromGraph,
    openNoteInNotesWorkspace:
      module.useNotesWorkspaceNavigation().openNoteInNotesWorkspace,
    openTagInNotesWorkspace:
      module.useNotesWorkspaceNavigation().openTagInNotesWorkspace,
    recordNavigation,
    isNavigatingHistory,
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

  it('records graph-originated note opens in navigation history', async () => {
    const context = await setup()
    context.currentRoute.value = { name: 'notes-space/graph' }

    context.getNotesById.mockResolvedValue({
      data: {
        id: 42,
        folder: {
          id: 7,
          name: 'Docs',
        },
      },
    })

    await context.openNoteFromGraph(42)

    expect(context.recordNavigation).toHaveBeenCalledTimes(1)
    expect(context.selectNote).toHaveBeenCalledWith(42)
  })

  it('skips history recording for graph opens during history restoration', async () => {
    const context = await setup()

    context.currentRoute.value = { name: 'notes-space/graph' }
    context.isNavigatingHistory.value = true
    context.getNotesById.mockResolvedValue({
      data: {
        id: 42,
        folder: {
          id: 7,
          name: 'Docs',
        },
      },
    })

    await context.openNoteFromGraph(42)

    expect(context.recordNavigation).not.toHaveBeenCalled()
    expect(context.selectNote).toHaveBeenCalledWith(42)
  })

  it('records dashboard graph note opens in navigation history', async () => {
    const context = await setup()

    context.currentRoute.value = { name: 'notes-space/dashboard' }
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

    expect(context.recordNavigation).toHaveBeenCalledTimes(1)
    expect(context.selectNote).toHaveBeenCalledWith(42)
  })
})
