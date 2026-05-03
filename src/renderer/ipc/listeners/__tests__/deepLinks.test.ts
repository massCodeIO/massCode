import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

interface SetupOptions {
  httpRequestResponse?: any
  httpRequestThrows?: boolean
  noteResponse?: any
  noteRouteName?: string
  noteThrows?: boolean
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
  const getHttpFolders = vi.fn(async () => undefined)
  const selectHttpFolder = vi.fn(async () => undefined)
  const clearHttpFolderSelection = vi.fn()
  const getHttpRequests = vi.fn(async () => undefined)
  const selectHttpRequest = vi.fn()

  const getNoteFolders = vi.fn(async () => undefined)
  const selectNoteFolder = vi.fn(async () => undefined)
  const clearNoteFolderSelection = vi.fn()
  const clearNotesState = vi.fn()
  const getNotes = vi.fn(async () => undefined)
  const selectNote = vi.fn()
  const withNotesLoading = vi.fn(async (loader: () => Promise<void>) => {
    await loader()
  })
  const historyEntries = ref<any[]>([])
  const historyCursor = ref(-1)
  const isNavigatingHistory = ref(false)
  const goBack = vi.fn(() => historyEntries.value[0])
  const goForward = vi.fn(() => historyEntries.value.at(-1))
  const recordNavigation = vi.fn(async (navigate: () => Promise<void>) => {
    await navigate()
  })
  const queueNavigationUIStateRestore = vi.fn()

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

  const getNotesById = options.noteThrows
    ? vi.fn(async () => {
        throw new Error('not found')
      })
    : vi.fn(async () => ({
        data: options.noteResponse ?? {
          content: 'Hello world',
          folder: null,
          id: 15,
          isDeleted: 1,
          name: 'Note',
        },
      }))

  const getHttpRequestsById = options.httpRequestThrows
    ? vi.fn(async () => {
        throw new Error('not found')
      })
    : vi.fn(async () => ({
        data: options.httpRequestResponse ?? {
          folderId: 4,
          id: 8,
          method: 'GET',
          name: 'HTTP request',
          url: 'https://example.com',
        },
      }))

  const router = {
    currentRoute: ref({
      name: options.noteRouteName ?? options.snippetRouteName ?? 'main',
    }),
    push: vi.fn(async ({ name }: { name: string }) => {
      router.currentRoute.value = { name }
    }),
  }

  const initCodeSpace = vi.fn(async () => undefined)
  const initNotesSpace = vi.fn(async () => undefined)
  const initHttpSpace = vi.fn(async () => undefined)
  const isAppLoading = ref(false)
  const isCodeSpaceInitialized = ref(false)
  const isHttpSpaceInitialized = ref(false)
  const isNotesSpaceInitialized = ref(false)
  const pendingCodeNavigation = ref(false)
  const pendingNotesNavigation = ref(false)

  vi.doMock('@/composables', () => ({
    initCodeSpace,
    queueNavigationUIStateRestore,
    useApp: () => ({
      focusedFolderId: ref<number | undefined>(),
      focusedSnippetId: ref<number | undefined>(),
      highlightedFolderIds: ref(new Set<number>()),
      highlightedSnippetIds: ref(new Set<number>()),
      isAppLoading,
      isCodeSpaceInitialized,
      pendingCodeNavigation,
      state,
    }),
    useFolders: () => ({
      clearFolderSelection,
      getFolders,
      selectFolder,
    }),
    useHttpApp: () => ({
      focusedRequestId: ref<number | undefined>(),
      highlightedFolderIds: ref(new Set<number>()),
      highlightedRequestIds: ref(new Set<number>()),
      isHttpSpaceInitialized,
    }),
    useHttpFolders: () => ({
      clearFolderSelection: clearHttpFolderSelection,
      getHttpFolders,
      selectHttpFolder,
    }),
    useHttpRequests: () => ({
      getHttpRequests,
      selectHttpRequest,
    }),
    useHttpSpaceInit: () => ({
      initHttpSpace,
    }),
    useNoteFolders: () => ({
      clearFolderSelection: clearNoteFolderSelection,
      getNoteFolders,
      selectNoteFolder,
    }),
    useNavigationHistory: () => ({
      canGoBack: computed(() => historyCursor.value > 0),
      canGoForward: computed(
        () =>
          historyCursor.value >= 0
          && historyCursor.value < historyEntries.value.length - 1,
      ),
      cursor: historyCursor,
      entries: historyEntries,
      goBack,
      goForward,
      isNavigatingHistory,
      recordNavigation,
    }),
    useNotes: () => ({
      clearNotesState,
      getNotes,
      selectedNote: ref({
        id: 15,
        name: 'Current note',
      }),
      selectNote,
      withNotesLoading,
    }),
    useNotesApp: () => ({
      focusedNoteId: ref<number | undefined>(),
      highlightedFolderIds: ref(new Set<number>()),
      highlightedNoteIds: ref(new Set<number>()),
      isNotesSpaceInitialized,
      notesState,
      pendingNotesNavigation,
    }),
    useNotesSpaceInitialization: () => ({
      initNotesSpace,
    }),
    useSnippets: () => ({
      getSnippets,
      selectedSnippet: ref({
        id: 42,
        name: 'Current snippet',
      }),
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
      httpRequests: {
        getHttpRequestsById,
      },
    },
  }))

  vi.doMock('@/router', () => ({
    RouterName: {
      main: 'main',
      httpSpace: 'http-space',
      notesGraph: 'notes-space/graph',
      notesSpace: 'notes-space',
      notesPresentation: 'notes-space/presentation',
    },
    router,
  }))

  const module = await import('../deepLinks')

  return {
    clearFolderSelection,
    clearHttpFolderSelection,
    clearNoteFolderSelection,
    clearNotesState,
    getFolders,
    getHttpFolders,
    getHttpRequests,
    getNotes,
    getSnippets,
    goBack,
    goForward,
    initCodeSpace,
    initHttpSpace,
    initNotesSpace,
    isAppLoading,
    isCodeSpaceInitialized,
    isHttpSpaceInitialized,
    isNotesSpaceInitialized,
    isNavigatingHistory,
    historyCursor,
    historyEntries,
    module,
    notesState,
    pendingCodeNavigation,
    pendingNotesNavigation,
    queueNavigationUIStateRestore,
    recordNavigation,
    router,
    selectFolder,
    selectHttpFolder,
    selectHttpRequest,
    selectNote,
    selectNoteFolder,
    selectSnippet,
    state,
    withNotesLoading,
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
    expect(context.clearNotesState).toHaveBeenCalledTimes(1)
    expect(context.isNotesSpaceInitialized.value).toBe(true)
    expect(context.pendingNotesNavigation.value).toBe(false)
  })

  it('opens HTTP request links in the request folder context', async () => {
    const context = await setup({
      httpRequestResponse: {
        folderId: 4,
        id: 8,
        method: 'POST',
        name: 'Create snippet',
        url: 'https://example.com/snippets',
      },
      snippetRouteName: 'notes-space',
    })

    await context.module.openHttpRequestDeepLink(8)

    expect(context.router.push).toHaveBeenCalledWith({ name: 'http-space' })
    expect(context.getHttpRequests).toHaveBeenCalledTimes(1)
    expect(context.getHttpFolders).toHaveBeenCalledTimes(1)
    expect(context.selectHttpFolder).toHaveBeenCalledWith(4)
    expect(context.selectHttpRequest).toHaveBeenCalledWith(8)
    expect(context.isHttpSpaceInitialized.value).toBe(true)
  })

  it('opens root HTTP request links without a folder selection', async () => {
    const context = await setup({
      httpRequestResponse: {
        folderId: null,
        id: 8,
        method: 'GET',
        name: 'List snippets',
        url: 'https://example.com/snippets',
      },
    })

    await context.module.openHttpRequestDeepLink(8)

    expect(context.clearHttpFolderSelection).toHaveBeenCalledTimes(1)
    expect(context.selectHttpFolder).not.toHaveBeenCalled()
    expect(context.selectHttpRequest).toHaveBeenCalledWith(8)
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

  it('records history when opening internal target', async () => {
    const context = await setup({
      snippetRouteName: 'notes-space',
    })

    await context.module.openInternalTarget({ id: 42, type: 'snippet' })

    expect(context.recordNavigation).toHaveBeenCalledTimes(1)
    expect(context.selectSnippet).toHaveBeenCalledWith(42)
  })

  it('records history when opening an internal HTTP request target', async () => {
    const context = await setup({
      snippetRouteName: 'notes-space',
    })

    await context.module.openInternalTarget({ id: 8, type: 'http-request' })

    expect(context.recordNavigation).toHaveBeenCalledTimes(1)
    expect(context.selectHttpRequest).toHaveBeenCalledWith(8)
  })

  it('restores target from history on back navigation', async () => {
    const context = await setup({
      snippetRouteName: 'main',
    })

    context.goBack.mockReturnValue({
      id: 15,
      type: 'note',
    })

    await context.module.navigateBack()

    expect(context.goBack).toHaveBeenCalledTimes(1)
    expect(context.queueNavigationUIStateRestore).toHaveBeenCalledWith({
      id: 15,
      type: 'note',
    })
    expect(context.router.push).toHaveBeenCalledWith({ name: 'notes-space' })
    expect(context.selectNote).toHaveBeenCalledWith(15)
    expect(context.isNavigatingHistory.value).toBe(false)
  })

  it('restores graph route from history on back navigation', async () => {
    const context = await setup({
      snippetRouteName: 'notes-space',
    })

    context.goBack.mockReturnValue({
      routeName: 'notes-space/graph',
      type: 'route',
    })

    await context.module.navigateBack()

    expect(context.goBack).toHaveBeenCalledTimes(1)
    expect(context.router.push).toHaveBeenCalledWith({
      name: 'notes-space/graph',
    })
    expect(context.selectNote).not.toHaveBeenCalled()
    expect(context.isNavigatingHistory.value).toBe(false)
  })

  it('falls back to notes init when note deep link fails after route change', async () => {
    const context = await setup({
      noteRouteName: 'main',
      noteThrows: true,
    })

    await context.module.openNoteDeepLink(15)

    expect(context.clearNotesState).toHaveBeenCalledTimes(1)
    expect(context.initNotesSpace).toHaveBeenCalledTimes(1)
    expect(context.pendingNotesNavigation.value).toBe(false)
  })
})
