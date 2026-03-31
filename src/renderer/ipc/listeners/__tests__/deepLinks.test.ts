import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

interface SetupOptions {
  noteResponse?: any
  noteRouteName?: string
  snippetResponse?: any
  snippetRouteName?: string
  snippetThrows?: boolean
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const state = {
    libraryFilter: undefined,
    snippetId: undefined,
    tagId: undefined,
  }
  const notesState = {
    libraryFilter: undefined,
    noteId: undefined,
    tagId: undefined,
  }

  const getFolders = vi.fn(async () => undefined)
  const selectFolder = vi.fn(async () => undefined)
  const clearFolderSelection = vi.fn()
  const getSnippets = vi.fn(async () => undefined)
  const selectSnippet = vi.fn()

  const getNoteFolders = vi.fn(async () => undefined)
  const selectNoteFolder = vi.fn(async () => undefined)
  const clearNoteFolderSelection = vi.fn()
  const getNotes = vi.fn(async () => undefined)
  const selectNote = vi.fn()

  const getSnippetsById = options.snippetThrows
    ? vi.fn(async () => {
        throw new Error('not found')
      })
    : vi.fn(async () => ({
        data: options.snippetResponse ?? {
          folder: { id: 10, name: 'Backend' },
          id: 42,
          isDeleted: 0,
          name: 'Snippet',
        },
      }))

  const getNotesById = vi.fn(async () => ({
    data: options.noteResponse ?? {
      content: 'Hello world',
      folder: null,
      id: 15,
      isDeleted: 1,
      name: 'Note',
    },
  }))

  const router = {
    currentRoute: ref({ name: options.snippetRouteName ?? 'main' }),
    push: vi.fn(async ({ name }: { name: string }) => {
      router.currentRoute.value = { name }
    }),
  }

  vi.doMock('@/composables', () => ({
    useApp: () => ({
      focusedFolderId: ref<number | undefined>(),
      focusedSnippetId: ref<number | undefined>(),
      highlightedFolderIds: ref(new Set<number>()),
      highlightedSnippetIds: ref(new Set<number>()),
      state,
    }),
    useFolders: () => ({
      clearFolderSelection,
      getFolders,
      selectFolder,
    }),
    useNoteFolders: () => ({
      clearFolderSelection: clearNoteFolderSelection,
      getNoteFolders,
      selectNoteFolder,
    }),
    useNotes: () => ({
      getNotes,
      selectNote,
    }),
    useNotesApp: () => ({
      focusedNoteId: ref<number | undefined>(),
      highlightedFolderIds: ref(new Set<number>()),
      highlightedNoteIds: ref(new Set<number>()),
      notesState,
    }),
    useSnippets: () => ({
      getSnippets,
      selectSnippet,
    }),
  }))

  vi.doMock('@/services/api', () => ({
    api: {
      notes: {
        getNotesById,
      },
      snippets: {
        getSnippetsById,
      },
    },
  }))

  vi.doMock('@/router', () => ({
    RouterName: {
      main: 'main',
      notesSpace: 'notes-space',
    },
    router,
  }))

  const module = await import('../deepLinks')

  return {
    clearFolderSelection,
    clearNoteFolderSelection,
    getFolders,
    getNotes,
    getSnippets,
    module,
    notesState,
    router,
    selectFolder,
    selectNote,
    selectNoteFolder,
    selectSnippet,
    state,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deepLinks', () => {
  it('opens snippet links in the current folder context', async () => {
    const context = await setup({
      snippetResponse: {
        folder: { id: 7, name: 'Docs' },
        id: 42,
        isDeleted: 0,
        name: 'Snippet',
      },
    })

    await context.module.openSnippetDeepLink(42)

    expect(context.getFolders).toHaveBeenCalledWith(false)
    expect(context.selectFolder).toHaveBeenCalledWith(7)
    expect(context.getSnippets).toHaveBeenCalledWith({ folderId: 7 })
    expect(context.selectSnippet).toHaveBeenCalledWith(42)
  })

  it('opens note links in trash context when folder is empty and note is deleted', async () => {
    const context = await setup({
      noteResponse: {
        content: 'Archived',
        folder: null,
        id: 15,
        isDeleted: 1,
        name: 'Deleted note',
      },
      snippetRouteName: 'preferences',
    })

    await context.module.openNoteDeepLink(15)

    expect(context.router.push).toHaveBeenCalledWith({ name: 'notes-space' })
    expect(context.clearNoteFolderSelection).toHaveBeenCalled()
    expect(context.notesState.libraryFilter).toBe('trash')
    expect(context.getNotes).toHaveBeenCalledWith({ isDeleted: 1 })
    expect(context.selectNote).toHaveBeenCalledWith(15)
  })

  it('falls back to legacy folderId for old snippet deeplinks', async () => {
    const context = await setup({
      snippetThrows: true,
    })

    await context.module.handleDeepLink(
      'masscode://goto?folderId=11&snippetId=42',
    )

    expect(context.selectFolder).toHaveBeenCalledWith(11)
    expect(context.getSnippets).toHaveBeenCalledWith({ folderId: 11 })
    expect(context.selectSnippet).toHaveBeenCalledWith(42)
  })
})
