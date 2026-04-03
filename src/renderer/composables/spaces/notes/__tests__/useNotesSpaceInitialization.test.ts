import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

interface SetupOptions {
  isInitialized?: boolean
  noteId?: number
  displayedNoteIds?: number[]
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const isNotesSpaceInitialized = ref(options.isInitialized ?? false)
  const pendingNotesNavigation = ref(false)
  const notesState = {
    noteId: options.noteId,
    folderId: undefined,
  }
  const displayedNotes = ref(
    (options.displayedNoteIds ?? []).map(id => ({ id })),
  )

  const getNoteFolders = vi.fn(async () => undefined)
  const getNotes = vi.fn(async () => undefined)
  const getNoteTags = vi.fn(async () => undefined)
  const selectFirstNote = vi.fn(() => {
    const firstNote = displayedNotes.value?.[0]
    notesState.noteId = firstNote?.id
  })
  const hideNotesViewModes = vi.fn()
  const showAllNotesPanels = vi.fn()

  vi.doMock('../useNotesApp', () => ({
    useNotesApp: () => ({
      isNotesSpaceInitialized,
      notesState,
      pendingNotesNavigation,
      hideNotesViewModes,
      showAllNotesPanels,
    }),
  }))
  vi.doMock('../useNoteFolders', () => ({
    useNoteFolders: () => ({ getNoteFolders }),
  }))
  vi.doMock('../useNotes', () => ({
    useNotes: () => ({ getNotes, selectFirstNote }),
  }))
  vi.doMock('../useNoteTags', () => ({
    useNoteTags: () => ({ getNoteTags }),
  }))
  vi.doMock('../useNoteSearch', () => ({
    useNoteSearch: () => ({ displayedNotes }),
  }))

  const { useNotesSpaceInitialization } = await import(
    '../useNotesSpaceInitialization'
  )

  return {
    getNoteFolders,
    getNotes,
    getNoteTags,
    initNotesSpace: useNotesSpaceInitialization().initNotesSpace,
    isNotesSpaceInitialized,
    selectFirstNote,
    hideNotesViewModes,
    showAllNotesPanels,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNotesSpaceInitialization', () => {
  it('loads notes entities and keeps selected note when it exists', async () => {
    const context = await setup({ noteId: 2, displayedNoteIds: [1, 2, 3] })

    await context.initNotesSpace()

    expect(context.getNoteFolders).toHaveBeenCalledTimes(1)
    expect(context.getNotes).toHaveBeenCalledTimes(1)
    expect(context.getNoteTags).toHaveBeenCalledTimes(1)
    expect(context.selectFirstNote).not.toHaveBeenCalled()
    expect(context.hideNotesViewModes).not.toHaveBeenCalled()
    expect(context.showAllNotesPanels).not.toHaveBeenCalled()
    expect(context.isNotesSpaceInitialized.value).toBe(true)
  })

  it('selects first note when selected note is absent in list', async () => {
    const context = await setup({ noteId: 42, displayedNoteIds: [1, 2, 3] })

    await context.initNotesSpace()

    expect(context.selectFirstNote).toHaveBeenCalledTimes(1)
    expect(context.hideNotesViewModes).not.toHaveBeenCalled()
    expect(context.showAllNotesPanels).not.toHaveBeenCalled()
  })

  it('selects first note when no selected note in state', async () => {
    const context = await setup({ displayedNoteIds: [1] })

    await context.initNotesSpace()

    expect(context.selectFirstNote).toHaveBeenCalledTimes(1)
    expect(context.hideNotesViewModes).not.toHaveBeenCalled()
    expect(context.showAllNotesPanels).not.toHaveBeenCalled()
  })

  it('shows panels when no note is selected after init', async () => {
    const context = await setup({
      displayedNoteIds: [],
      noteId: 42,
    })

    await context.initNotesSpace()

    expect(context.hideNotesViewModes).toHaveBeenCalledTimes(1)
    expect(context.showAllNotesPanels).toHaveBeenCalledTimes(1)
  })

  it('skips loading when notes space is already initialized', async () => {
    const context = await setup({
      isInitialized: true,
      noteId: 1,
      displayedNoteIds: [1, 2, 3],
    })

    await context.initNotesSpace()

    expect(context.getNoteFolders).not.toHaveBeenCalled()
    expect(context.getNotes).not.toHaveBeenCalled()
    expect(context.getNoteTags).not.toHaveBeenCalled()
  })

  it('skips loading while note deep link navigation is pending', async () => {
    const context = await setup({
      noteId: 1,
      displayedNoteIds: [1, 2, 3],
    })

    const { useNotesApp } = await import('../useNotesApp')
    useNotesApp().pendingNotesNavigation.value = true

    await context.initNotesSpace()

    expect(context.getNoteFolders).not.toHaveBeenCalled()
    expect(context.getNotes).not.toHaveBeenCalled()
    expect(context.getNoteTags).not.toHaveBeenCalled()
  })

  it('loads again after initialization state reset', async () => {
    const context = await setup({
      isInitialized: true,
      noteId: 1,
      displayedNoteIds: [1, 2, 3],
    })

    const { resetNotesSpaceInitialization } = await import(
      '../useNotesSpaceInitialization'
    )

    resetNotesSpaceInitialization()
    await context.initNotesSpace()

    expect(context.getNoteFolders).toHaveBeenCalledTimes(1)
    expect(context.getNotes).toHaveBeenCalledTimes(1)
    expect(context.getNoteTags).toHaveBeenCalledTimes(1)
    expect(context.isNotesSpaceInitialized.value).toBe(true)
  })
})
