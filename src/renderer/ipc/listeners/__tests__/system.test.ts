import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

async function setup(activeSpace: 'code' | 'notes' | 'tools' | null) {
  vi.resetModules()
  vi.useFakeTimers()

  const ipcHandlers = new Map<string, (...args: any[]) => void>()
  const state = {
    snippetId: undefined,
  }
  const isCodeSpaceInitialized = ref(true)
  const isNotesSpaceInitialized = ref(true)
  const displayedSnippets = ref<{ id: number }[]>([])
  const getTags = vi.fn(async () => undefined)
  const normalizeCodeSelectionState = vi.fn(async () => undefined)
  const getFolders = vi.fn(async () => undefined)
  const getSnippets = vi.fn(async () => undefined)
  const reloadMathFromDisk = vi.fn(async () => undefined)
  const getNoteFolders = vi.fn(async () => undefined)
  const getNotes = vi.fn(async () => undefined)
  const getNoteTags = vi.fn(async () => undefined)
  const normalizeNotesSelectionState = vi.fn(async () => undefined)

  vi.doMock('@/composables', () => ({
    initCodeSpace: vi.fn(async () => undefined),
    useApp: () => ({
      state,
      highlightedFolderIds: ref(new Set<number>()),
      highlightedSnippetIds: ref(new Set<number>()),
      focusedSnippetId: ref<number | undefined>(),
      focusedFolderId: ref<number | undefined>(),
      isAppLoading: ref(false),
      isCodeSpaceInitialized,
      pendingCodeNavigation: ref(false),
    }),
    useFolders: () => ({
      selectFolder: vi.fn(),
      getFolders,
    }),
    useTags: () => ({
      getTags,
    }),
    normalizeCodeSelectionState,
    useNavigationHistory: () => ({
      canGoBack: ref(false),
      canGoForward: ref(false),
      cursor: ref(-1),
      entries: ref([]),
      goBack: vi.fn(),
      goForward: vi.fn(),
      isNavigatingHistory: ref(false),
      recordNavigation: vi.fn(async (navigate: () => Promise<void>) => {
        await navigate()
      }),
    }),
    useMathNotebook: () => ({
      reloadFromDisk: reloadMathFromDisk,
    }),
    useNoteFolders: () => ({
      getNoteFolders,
    }),
    useNotes: () => ({
      getNotes,
      hasBusyNoteContentUpdates: vi.fn(() => false),
    }),
    useNotesApp: () => ({
      isNotesSpaceInitialized,
    }),
    useNotesSpaceInitialization: () => ({
      initNotesSpace: vi.fn(async () => undefined),
    }),
    useNotesDashboard: () => ({
      getNotesDashboard: vi.fn(async () => undefined),
    }),
    useNotesGraph: () => ({
      getNotesGraph: vi.fn(async () => undefined),
    }),
    normalizeNotesSelectionState,
    useNoteTags: () => ({
      getNoteTags,
    }),
    useSnippets: () => ({
      selectSnippet: vi.fn(),
      getSnippets,
      selectFirstSnippet: vi.fn(),
      displayedSnippets,
    }),
    useSnippetUpdate: () => ({
      hasBusyContentUpdates: vi.fn(() => false),
    }),
    useSonner: () => ({
      sonner: vi.fn(),
    }),
    useStorageMutation: () => ({
      shouldSkipStorageSyncRefresh: vi.fn(() => false),
    }),
  }))
  vi.doMock('@/electron', () => ({
    i18n: {
      t: vi.fn((key: string) => key),
    },
    ipc: {
      on: vi.fn((channel: string, handler: (...args: any[]) => void) => {
        ipcHandlers.set(channel, handler)
      }),
      invoke: vi.fn(),
    },
  }))

  vi.doMock('@/services/api', () => ({
    api: {
      notes: { getNotesById: vi.fn() },
      snippets: { getSnippetsById: vi.fn() },
    },
  }))

  vi.doMock('@/router', () => ({
    RouterName: {
      main: 'main',
      notesSpace: 'notes-space',
      notesPresentation: 'notes-space/presentation',
    },
    router: {
      currentRoute: ref({ name: 'main' }),
      push: vi.fn(async () => undefined),
    },
  }))

  vi.doMock('@/spaceDefinitions', () => ({
    getActiveSpaceId: vi.fn(() => activeSpace),
  }))

  const { registerSystemListeners } = await import('../system')

  registerSystemListeners()

  return {
    getFolders,
    getTags,
    getNoteFolders,
    getNotes,
    getNoteTags,
    getSnippets,
    ipcHandlers,
    isCodeSpaceInitialized,
    isNotesSpaceInitialized,
    normalizeCodeSelectionState,
    normalizeNotesSelectionState,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('registerSystemListeners', () => {
  it('invalidates code and notes initialization after storage sync', async () => {
    const context = await setup('tools')

    context.ipcHandlers.get('system:storage-synced')?.(undefined)
    await vi.advanceTimersByTimeAsync(300)

    expect(context.isCodeSpaceInitialized.value).toBe(false)
    expect(context.isNotesSpaceInitialized.value).toBe(false)
    expect(context.getFolders).not.toHaveBeenCalled()
    expect(context.getSnippets).not.toHaveBeenCalled()
    expect(context.getNoteFolders).not.toHaveBeenCalled()
    expect(context.getNotes).not.toHaveBeenCalled()
    expect(context.getNoteTags).not.toHaveBeenCalled()
  })

  it('refreshes code space through tags and normalized selection state', async () => {
    const context = await setup('code')

    context.ipcHandlers.get('system:storage-synced')?.(undefined)
    await vi.advanceTimersByTimeAsync(300)

    expect(context.getFolders).toHaveBeenCalledTimes(1)
    expect(context.getTags).toHaveBeenCalledTimes(1)
    expect(context.normalizeCodeSelectionState).toHaveBeenCalledTimes(1)
    expect(context.getSnippets).not.toHaveBeenCalled()
  })

  it('refreshes notes space through tags and normalized selection state', async () => {
    const context = await setup('notes')

    context.ipcHandlers.get('system:storage-synced')?.(undefined)
    await vi.advanceTimersByTimeAsync(300)

    expect(context.getNoteFolders).toHaveBeenCalledTimes(1)
    expect(context.getNoteTags).toHaveBeenCalledTimes(1)
    expect(context.normalizeNotesSelectionState).toHaveBeenCalledTimes(1)
    expect(context.getNotes).not.toHaveBeenCalled()
  })
})
