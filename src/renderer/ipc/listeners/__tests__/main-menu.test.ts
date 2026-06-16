import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

async function setup() {
  vi.resetModules()

  globalThis.watch = vi.fn()

  const ipcHandlers = new Map<string, (...args: any[]) => void>()
  const navigateBack = vi.fn(async () => undefined)
  const navigateForward = vi.fn(async () => undefined)
  const executeCurrentRequest = vi.fn(async () => undefined)
  const saveCurrentRequest = vi.fn(async () => undefined)
  const createNoteAndSelect = vi.fn()
  const createTaskAndSelect = vi.fn()
  const getHttpRequests = vi.fn(async () => undefined)
  const getNotes = vi.fn(async () => undefined)
  const getSnippets = vi.fn(async () => undefined)
  const setContentSortField = vi.fn()
  const setContentSortOrder = vi.fn()
  const currentDraft = ref({ url: 'https://example.com' })
  const isExecuting = ref(false)
  const getActiveSpaceId = vi.fn(() => 'code')

  vi.doMock('@/composables', () => ({
    useApp: () => ({
      codeLayoutMode: ref('all-panels'),
      isCompactListMode: ref(false),
      isShowCodePreview: ref(false),
      isShowJsonVisualizer: ref(false),
      setCodeLayoutMode: vi.fn(),
      toggleCompactListMode: vi.fn(),
      toggleCodeSidebar: vi.fn(),
    }),
    useEditor: () => ({
      settings: { fontSize: 14 },
    }),
    isContentSortField: (value: unknown) =>
      value === 'createdAt' || value === 'updatedAt' || value === 'name',
    isContentSortOrder: (value: unknown) => value === 'ASC' || value === 'DESC',
    isSortableContentSpaceId: (value: unknown) =>
      value === 'code'
      || value === 'notes'
      || value === 'http'
      || value === 'math'
      || value === 'drawings',
    useContentSort: () => ({
      setContentSortField,
      setContentSortOrder,
    }),
    useFolders: () => ({
      createFolderAndSelect: vi.fn(),
    }),
    useMathNotebook: () => ({
      createSheet: vi.fn(),
    }),
    useNoteFolders: () => ({
      createNoteFolderAndSelect: vi.fn(),
    }),
    useNotes: () => ({
      createNoteAndSelect,
      createTaskAndSelect,
      getNotes,
      selectedNote: ref(undefined),
    }),
    useNotesApp: () => ({
      hideNotesViewModes: vi.fn(),
      isNotesMindmapShown: ref(false),
      isNotesPresentationShown: ref(false),
      notesEditorMode: ref('livePreview'),
      setNotesLayoutMode: vi.fn(),
      showNotesMindmap: vi.fn(),
      showNotesPresentation: vi.fn(),
      toggleNotesSidebar: vi.fn(),
    }),
    useHttpApp: () => ({
      setHttpLayoutMode: vi.fn(),
      toggleHttpSidebar: vi.fn(),
    }),
    useHttpExecute: () => ({
      executeCurrentRequest,
      isExecuting,
    }),
    useHttpRequests: () => ({
      currentDraft,
      getHttpRequests,
      saveCurrentRequest,
    }),
    useNotesEditor: () => ({
      settings: { fontSize: 14 },
    }),
    useSnippets: () => ({
      createSnippetAndSelect: vi.fn(),
      addFragment: vi.fn(),
      getSnippets,
      isAvailableToCodePreview: ref(false),
      selectedSnippetContent: ref(undefined),
    }),
  }))

  vi.doMock('@/electron', () => ({
    ipc: {
      send: vi.fn(),
      on: vi.fn((channel: string, handler: (...args: any[]) => void) => {
        ipcHandlers.set(channel, handler)
      }),
    },
  }))

  vi.doMock('@/router', () => ({
    RouterName: {
      preferences: 'preferences',
      devtools: 'devtools',
      notesSpace: 'notes-space',
      mathNotebook: 'math-notebook',
    },
    router: {
      push: vi.fn(),
    },
  }))

  vi.doMock('@/spaceDefinitions', () => ({
    getActiveSpaceId,
  }))

  vi.doMock('~/main/store/constants', () => ({
    EDITOR_DEFAULTS: { fontSize: 14 },
    NOTES_EDITOR_DEFAULTS: { fontSize: 14 },
  }))

  vi.doMock('../deepLinks', () => ({
    navigateBack,
    navigateForward,
  }))

  const { registerMainMenuListeners } = await import('../main-menu')
  registerMainMenuListeners()

  return {
    ipcHandlers,
    currentDraft,
    createNoteAndSelect,
    createTaskAndSelect,
    executeCurrentRequest,
    getActiveSpaceId,
    getHttpRequests,
    getNotes,
    getSnippets,
    isExecuting,
    navigateBack,
    navigateForward,
    saveCurrentRequest,
    setContentSortField,
    setContentSortOrder,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registerMainMenuListeners', () => {
  it('handles history back and forward actions', async () => {
    const context = await setup()

    context.ipcHandlers.get('main-menu:navigate-back')?.()
    context.ipcHandlers.get('main-menu:navigate-forward')?.()

    expect(context.navigateBack).toHaveBeenCalledTimes(1)
    expect(context.navigateForward).toHaveBeenCalledTimes(1)
  })

  it('handles note and task creation actions', async () => {
    const context = await setup()

    context.ipcHandlers.get('main-menu:new-note')?.()
    context.ipcHandlers.get('main-menu:new-task')?.()

    expect(context.createNoteAndSelect).toHaveBeenCalledTimes(1)
    expect(context.createTaskAndSelect).toHaveBeenCalledTimes(1)
  })

  it('saves and sends the current http request from the menu shortcut', async () => {
    const context = await setup()
    context.getActiveSpaceId.mockReturnValue('http')

    await context.ipcHandlers.get('main-menu:send-http-request')?.()

    expect(context.saveCurrentRequest).toHaveBeenCalledTimes(1)
    expect(context.executeCurrentRequest).toHaveBeenCalledTimes(1)
  })

  it('ignores send request outside http space', async () => {
    const context = await setup()

    await context.ipcHandlers.get('main-menu:send-http-request')?.()

    expect(context.saveCurrentRequest).not.toHaveBeenCalled()
    expect(context.executeCurrentRequest).not.toHaveBeenCalled()
  })

  it('updates active code sort from the menu', async () => {
    const context = await setup()
    const setSortField = context.ipcHandlers.get(
      'main-menu:set-content-sort-field',
    )
    const setSortOrder = context.ipcHandlers.get(
      'main-menu:set-content-sort-order',
    )

    await setSortField?.(undefined, 'updatedAt')
    await setSortOrder?.(undefined, 'ASC')

    expect(context.setContentSortField).toHaveBeenCalledWith(
      'code',
      'updatedAt',
    )
    expect(context.setContentSortOrder).toHaveBeenCalledWith('code', 'ASC')
    expect(context.getSnippets).toHaveBeenCalledTimes(2)
  })

  it('updates active http sort from the menu', async () => {
    const context = await setup()
    context.getActiveSpaceId.mockReturnValue('http')
    const setSortField = context.ipcHandlers.get(
      'main-menu:set-content-sort-field',
    )

    await setSortField?.(undefined, 'name')

    expect(context.setContentSortField).toHaveBeenCalledWith('http', 'name')
    expect(context.getHttpRequests).toHaveBeenCalledTimes(1)
  })

  it('updates active math sort from the menu', async () => {
    const context = await setup()
    context.getActiveSpaceId.mockReturnValue('math')
    const setSortField = context.ipcHandlers.get(
      'main-menu:set-content-sort-field',
    )

    await setSortField?.(undefined, 'updatedAt')

    expect(context.setContentSortField).toHaveBeenCalledWith(
      'math',
      'updatedAt',
    )
    expect(context.getSnippets).not.toHaveBeenCalled()
    expect(context.getNotes).not.toHaveBeenCalled()
    expect(context.getHttpRequests).not.toHaveBeenCalled()
  })

  it('updates active drawings sort from the menu', async () => {
    const context = await setup()
    context.getActiveSpaceId.mockReturnValue('drawings')
    const setSortOrder = context.ipcHandlers.get(
      'main-menu:set-content-sort-order',
    )

    await setSortOrder?.(undefined, 'ASC')

    expect(context.setContentSortOrder).toHaveBeenCalledWith('drawings', 'ASC')
    expect(context.getSnippets).not.toHaveBeenCalled()
    expect(context.getNotes).not.toHaveBeenCalled()
    expect(context.getHttpRequests).not.toHaveBeenCalled()
  })
})
