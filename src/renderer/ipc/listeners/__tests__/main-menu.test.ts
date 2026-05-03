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
      createNoteAndSelect: vi.fn(),
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
      saveCurrentRequest,
    }),
    useNotesEditor: () => ({
      settings: { fontSize: 14 },
    }),
    useSnippets: () => ({
      createSnippetAndSelect: vi.fn(),
      addFragment: vi.fn(),
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
    executeCurrentRequest,
    getActiveSpaceId,
    isExecuting,
    navigateBack,
    navigateForward,
    saveCurrentRequest,
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
})
