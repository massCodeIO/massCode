import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'

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
  const httpState = reactive<{
    activePanel?: string
    folderId?: number
    libraryFilter?: string
    requestId?: number
  }>({})
  const currentRequest = ref({ id: 7, name: 'Cached A' })
  const selectHttpRequest = vi.fn()

  const getNoteFolders = vi.fn(async () => undefined)
  const selectNoteFolder = vi.fn(async () => undefined)
  const clearNoteFolderSelection = vi.fn()
  const clearNoteSearch = vi.fn()
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
  const initHttpSpace = vi.fn(async (): Promise<void> => undefined)
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
      httpState,
      isHttpSpaceInitialized,
    }),
    useHttpFolders: () => ({
      clearFolderSelection: clearHttpFolderSelection,
      getHttpFolders,
      folders: ref([{ id: 4 }]),
      getFolderByIdFromTree: (_: unknown, id: number) =>
        id === 4 ? { id: 4 } : undefined,
      selectHttpFolder,
    }),
    useHttpRequests: () => ({
      getHttpRequests,
      selectHttpRequest,
      currentRequest,
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
      restoreHistory: async (
        direction: number,
        restore: (entry: any) => Promise<string>,
      ) => {
        isNavigatingHistory.value = true
        try {
          return await restore(direction === -1 ? goBack() : goForward())
        }
        finally {
          isNavigatingHistory.value = false
        }
      },
    }),
    useNoteSearch: () => ({ clearSearch: clearNoteSearch }),
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

  // deepLinks импортирует '@/electron' напрямую: без мока модуль падает на
  // window.electron в node-окружении.
  vi.doMock('@/electron', () => ({
    i18n: {
      t: (key: string) => key,
    },
    ipc: {
      invoke: vi.fn(),
      on: vi.fn(),
    },
    store: {
      app: {
        get: vi.fn(),
        set: vi.fn(),
      },
      preferences: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
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

  const { httpRuntimeNavigation } = await import(
    '@/composables/spaces/http/runtimeNavigation'
  )
  const module = await import('../deepLinks')

  return {
    httpRuntimeNavigation,
    currentRequest,
    httpState,
    clearFolderSelection,
    clearHttpFolderSelection,
    clearNoteFolderSelection,
    clearNotesState,
    clearNoteSearch,
    getFolders,
    getNoteFolders,
    getNotesById,
    getSnippetsById,
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

  it('clears search before replacing its results with a history target folder', async () => {
    const context = await setup({
      noteResponse: { id: 15, name: 'Note', folder: { id: 3 }, isDeleted: 0 },
    })
    await context.module.openNoteDeepLink(15, true)
    expect(context.clearNoteSearch).toHaveBeenCalledOnce()
    expect(context.clearNoteSearch.mock.invocationCallOrder[0]).toBeLessThan(
      context.getNotes.mock.invocationCallOrder[0]!,
    )
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

  it('finishes HTTP initialization before opening the route and selecting a link target', async () => {
    const context = await setup({ snippetRouteName: 'notes-space' })
    let finishInit!: () => void
    context.initHttpSpace.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishInit = resolve
        }),
    )

    const navigation = context.module.openHttpRequestDeepLink(8)
    await vi.waitFor(() =>
      expect(context.initHttpSpace).toHaveBeenCalledTimes(1),
    )
    expect(context.router.push).not.toHaveBeenCalled()
    expect(context.selectHttpRequest).not.toHaveBeenCalled()

    finishInit()
    await navigation
    expect(context.router.push).toHaveBeenCalledWith({ name: 'http-space' })
    expect(context.selectHttpRequest).toHaveBeenLastCalledWith(8)
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
      noteResponse: { id: 15, name: 'Note', folder: null, isDeleted: 0 },
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

  it('restores an HTTP collection or folder on back navigation', async () => {
    const context = await setup({ snippetRouteName: 'notes-space' })
    context.goBack.mockReturnValue({
      id: 4,
      name: 'Catalog',
      type: 'http-folder',
    })
    await context.module.navigateBack()
    expect(context.router.push).toHaveBeenCalledWith({ name: 'http-space' })
    expect(context.getHttpFolders).toHaveBeenCalledOnce()
    expect(context.selectHttpFolder).toHaveBeenCalledWith(4)
    expect(context.selectHttpRequest).not.toHaveBeenCalled()
    expect(context.selectNote).not.toHaveBeenCalled()
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

  it.each([404, 503])(
    'does not navigate or queue scroll when target fetch fails with %s',
    async (status) => {
      const context = await setup()
      context.goBack.mockReturnValue({ id: 15, type: 'note' })
      context.getNotesById.mockRejectedValue({ response: { status } })
      await context.module.navigateBack()
      expect(context.router.push).not.toHaveBeenCalled()
      expect(context.initNotesSpace).not.toHaveBeenCalled()
      expect(context.queueNavigationUIStateRestore).not.toHaveBeenCalled()
    },
  )

  it('keeps the Notes route when the final HTTP selection silently fails after a successful preflight', async () => {
    const context = await setup({ snippetRouteName: 'notes-space' })
    context.goBack.mockReturnValue({ id: 8, name: 'B', type: 'http-request' })
    context.historyEntries.value = [
      { id: 8, name: 'B', type: 'http-request' },
      { id: 15, name: 'N', type: 'note' },
    ]
    context.historyCursor.value = 1
    // The raw selector catches its final GET failure and retains cached A.
    context.selectHttpRequest.mockImplementation(async () => {
      expect(context.getHttpRequests).toHaveBeenCalledOnce()
      expect(context.router.currentRoute.value.name).toBe('notes-space')
    })
    await context.module.navigateBack()
    expect(context.selectHttpRequest).toHaveBeenCalledWith(8, false, {
      preservePanel: true,
    })
    expect(context.currentRequest.value.id).toBe(7)
    expect(context.router.push).not.toHaveBeenCalled()
    expect(context.historyCursor.value).toBe(1)
    expect(context.historyEntries.value).toHaveLength(2)
    expect(context.queueNavigationUIStateRestore).not.toHaveBeenCalled()
  })

  it('preserves the source HTTP folder panel when final request selection fails', async () => {
    const context = await setup({ snippetRouteName: 'http-space' })
    Object.assign(context.httpState, {
      activePanel: 'folder',
      folderId: 12,
      requestId: 7,
    })
    context.goBack.mockReturnValue({ id: 8, name: 'B', type: 'http-request' })
    context.selectHttpRequest.mockImplementation(
      async (_id, _shift, options) => {
        expect(options).toEqual({ preservePanel: true })
        context.httpState.requestId = 8
      },
    )
    await context.module.navigateBack()
    expect(context.httpState).toMatchObject({
      activePanel: 'folder',
      folderId: 12,
      requestId: 7,
    })
    expect(context.currentRequest.value.id).toBe(7)
    expect(context.queueNavigationUIStateRestore).not.toHaveBeenCalled()
  })

  it('does not restore soft-deleted notes', async () => {
    const context = await setup()
    context.goBack.mockReturnValue({ id: 15, type: 'note' })
    await context.module.navigateBack()
    expect(context.selectNote).not.toHaveBeenCalled()
    expect(context.router.push).not.toHaveBeenCalled()
    expect(context.queueNavigationUIStateRestore).not.toHaveBeenCalled()
  })

  it('does not change route or fall back when list loading fails after target validation', async () => {
    const context = await setup({
      noteResponse: { id: 15, folder: null, isDeleted: 0 },
    })
    context.goBack.mockReturnValue({ id: 15, type: 'note' })
    context.getNotes.mockRejectedValue(new Error('offline'))
    await context.module.navigateBack()
    expect(context.getNotesById).toHaveBeenCalledOnce()
    expect(context.router.push).not.toHaveBeenCalled()
    expect(context.initNotesSpace).not.toHaveBeenCalled()
    expect(context.queueNavigationUIStateRestore).not.toHaveBeenCalled()
  })

  it('initializes a cold Code space before its route and skips warm initialization', async () => {
    const context = await setup({ snippetRouteName: 'notes-space' })
    await context.module.openSpaceTarget('code')
    expect(context.initCodeSpace).toHaveBeenCalledOnce()
    expect(context.initCodeSpace.mock.invocationCallOrder[0]).toBeLessThan(
      context.router.push.mock.invocationCallOrder[0]!,
    )
    context.isCodeSpaceInitialized.value = true
    await context.module.openSpaceTarget('code')
    expect(context.initCodeSpace).toHaveBeenCalledOnce()
  })

  it.each(['notes', 'http'] as const)(
    'initializes cold %s before changing the route',
    async (space) => {
      const context = await setup()
      await context.module.openSpaceTarget(space)
      const init
        = space === 'notes' ? context.initNotesSpace : context.initHttpSpace
      expect(init).toHaveBeenCalledOnce()
      expect(init.mock.invocationCallOrder[0]).toBeLessThan(
        context.router.push.mock.invocationCallOrder[0]!,
      )
    },
  )

  it('preserves the current route and skips initialization when leaving HTTP is cancelled', async () => {
    const context = await setup({ snippetRouteName: 'http-space' })
    context.httpRuntimeNavigation.confirmLeave = vi.fn(async () => false)
    await context.module.openSpaceTarget('code')
    expect(context.router.push).not.toHaveBeenCalled()
    expect(context.initCodeSpace).not.toHaveBeenCalled()
    context.goBack.mockReturnValue({ id: 42, type: 'snippet' })
    await context.module.navigateBack()
    expect(context.getSnippetsById).not.toHaveBeenCalled()
    expect(context.queueNavigationUIStateRestore).not.toHaveBeenCalled()
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

it('loads folder trees when entering Code and Notes through Inbox links', async () => {
  const context = await setup({
    snippetResponse: { id: 42, folder: null, isDeleted: 0 },
    noteResponse: { id: 15, folder: null, isDeleted: 0 },
  })
  await context.module.openSnippetDeepLink(42)
  expect(context.getFolders).toHaveBeenCalledWith(false)
  await context.module.openNoteDeepLink(15)
  expect(context.getNoteFolders).toHaveBeenCalledOnce()
})
