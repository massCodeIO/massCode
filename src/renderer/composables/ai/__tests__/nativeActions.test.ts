import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  route: { value: { name: 'main' } },
  app: {
    state: { snippetContentIndex: 0 },
    isShowCodeImage: { value: false },
    isShowJsonVisualizer: { value: false },
    isShowCodePreview: { value: false },
  },
  snippet: {
    id: 1,
    name: 'One',
    contents: [
      { id: 10, language: 'json' },
      { id: 11, language: 'text' },
    ],
  },
  dock: { dockOpen: { value: true }, dockMaximized: { value: false } },
  cleanup: vi.fn(),
  invoke: vi.fn(),
  copy: vi.fn(async () => true),
  open: vi.fn(),
  bridge: vi.fn(async () => ({ status: 'unavailable' })),
  cursor: { value: 0 },
}))
vi.mock('@/electron', () => ({
  ipc: { invoke: mock.invoke },
  store: { preferences: { get: () => '/vault' } },
}))
vi.mock('@/router', () => ({
  router: { currentRoute: mock.route, push: vi.fn() },
  RouterName: {
    main: 'main',
    notesSpace: 'notes',
    notesPresentation: 'presentation',
    httpSpace: 'http',
  },
}))
vi.mock('@/composables/useApp', () => ({ useApp: () => mock.app }))
vi.mock('@/composables/useSnippets', () => ({
  useSnippets: () => ({
    selectedSnippet: { value: mock.snippet },
    selectedSnippetContent: {
      get value() {
        return mock.snippet.contents[mock.app.state.snippetContentIndex]
      },
    },
    selectedSnippetIds: { value: [1] },
    selectedSnippetRecordStatus: { value: 'ready' },
    isAvailableToCodePreview: { value: false },
  }),
}))
vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => mock.copy,
}))
vi.mock('@/composables/useNavigationHistory', () => ({
  useNavigationHistory: () => ({
    canGoBack: { value: false },
    canGoForward: { value: false },
    cursor: mock.cursor,
  }),
}))
vi.mock('@/composables/spaces/http/useHttpApp', () => ({
  useHttpApp: () => ({ httpState: {} }),
}))
vi.mock('@/composables/spaces/http/useHttpUi', () => ({
  useHttpUi: () => mock.dock,
}))
vi.mock('@/composables/spaces/http/useHttpRequests', () => ({
  useHttpRequests: () => ({
    currentRequest: { value: { id: 7 } },
    selectedRequestIds: { value: [7] },
  }),
}))
vi.mock('@/composables/spaces/notes/useNotes', () => ({
  useNotes: () => ({ cleanupCompletedTasks: mock.cleanup }),
}))
vi.mock('@/composables/spaces/notes/useNotesApp', () => ({
  useNotesApp: () => ({}),
}))
vi.mock('@/ipc/listeners/deepLinks', () => ({
  openInternalTarget: mock.open,
  openSpaceTarget: vi.fn(),
  navigateBack: vi.fn(),
  navigateForward: vi.fn(),
}))
vi.mock('../nativeBridges', () => ({ runNativeBridge: mock.bridge }))
const { executeNativeAction, readNativeState } = await import(
  '../nativeActions'
)
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('nextTick', async () => {})
  mock.route.value.name = 'main'
  mock.app.state.snippetContentIndex = 0
})
it('selects a fragment by stable content ID and verifies the actual native target', async () => {
  const result = await executeNativeAction(
    { action: 'navigate', target: { space: 'code', id: 1, contentId: 11 } },
    () => true,
    () => undefined,
  )
  expect(result).toMatchObject({
    status: 'done',
    state: { target: { space: 'code', id: 1, contentId: 11 } },
  })
  expect(mock.app.state.snippetContentIndex).toBe(1)
})
it('does not claim navigation success when the native handler left the original target', async () => {
  const result = await executeNativeAction(
    { action: 'navigate', target: { space: 'code', id: 2 } },
    () => true,
    () => undefined,
  )
  expect(result.status).toBe('cancelled')
})
it('copies actual current text without returning it to the model and refuses a stale target', async () => {
  const snapshot = () => ({
    space: 'code' as const,
    snippetId: 1,
    contentId: 10,
    text: 'live unsaved code',
    selection: '',
    language: 'json',
  })
  const operation = {
    action: 'copy' as const,
    part: 'content' as const,
    target: { space: 'code' as const, id: 1, contentId: 10 },
  }
  expect(await executeNativeAction(operation, () => true, snapshot)).toEqual({
    status: 'done',
    characters: 17,
    target: operation.target,
  })
  expect(mock.copy).toHaveBeenCalledWith('live unsaved code')
  expect(
    await executeNativeAction(
      { ...operation, target: { ...operation.target, contentId: 11 } },
      () => true,
      snapshot,
    ),
  ).toEqual({ status: 'stale' })
  expect(mock.copy).toHaveBeenCalledOnce()
  expect(readNativeState()).not.toHaveProperty('text')
})
it('does not report an unavailable executable preview as an opened view', async () => {
  expect(
    await executeNativeAction(
      {
        action: 'setView',
        target: { space: 'code', id: 1 },
        view: 'codePreview',
      },
      () => true,
      () => undefined,
    ),
  ).toEqual({ status: 'unavailable' })
  expect(mock.app.isShowCodePreview.value).toBe(false)
})

it('uses native reveal results and theme IPC without exposing paths', async () => {
  mock.invoke.mockResolvedValueOnce(false)
  expect(
    await executeNativeAction(
      { action: 'reveal', target: { space: 'http', id: 3 } },
      () => true,
      () => undefined,
    ),
  ).toMatchObject({ status: 'unavailable' })
  mock.invoke.mockResolvedValueOnce(true)
  expect(
    await executeNativeAction(
      { action: 'reveal', target: { space: 'notes', id: 3 } },
      () => true,
      () => undefined,
    ),
  ).toMatchObject({ status: 'done' })
  mock.invoke.mockResolvedValueOnce('/private/theme.json')
  expect(
    await executeNativeAction(
      { action: 'themeAction', command: 'createTemplate' },
      () => true,
      () => undefined,
    ),
  ).toEqual({ status: 'done', persisted: true })
  mock.invoke.mockRejectedValueOnce(new Error('open failed'))
  expect(
    await executeNativeAction(
      { action: 'themeAction', command: 'openDirectory' },
      () => true,
      () => undefined,
    ),
  ).toEqual({ status: 'failed' })
})
it('returns only a pre-close reload request receipt', async () => {
  expect(
    await executeNativeAction(
      { action: 'reload' },
      () => true,
      () => undefined,
    ),
  ).toEqual({ status: 'done', reloadRequested: true })
  expect(mock.invoke).not.toHaveBeenCalled()
})

it('maximizes and restores the actual open HTTP dock, refusing a closed one', async () => {
  mock.route.value.name = 'http'
  const operation = {
    action: 'httpDock' as const,
    target: { space: 'http' as const, id: 7 },
    maximized: true,
  }
  expect(
    await executeNativeAction(
      operation,
      () => true,
      () => undefined,
    ),
  ).toMatchObject({ status: 'done' })
  expect(mock.dock.dockMaximized.value).toBe(true)
  expect(
    await executeNativeAction(
      { ...operation, maximized: false },
      () => true,
      () => undefined,
    ),
  ).toMatchObject({ status: 'done' })
  expect(mock.dock.dockMaximized.value).toBe(false)
  mock.dock.dockOpen.value = false
  expect(
    await executeNativeAction(
      operation,
      () => true,
      () => undefined,
    ),
  ).toMatchObject({ status: 'unavailable' })
})

it('retains cleanup Undo privately after partial persistence or refresh failure', async () => {
  mock.cleanup.mockResolvedValue({
    status: 'failed',
    count: 1,
    persisted: true,
    receiptId: 'private-id',
  })
  const result = await executeNativeAction(
    { action: 'cleanupCompletedTasks' },
    () => true,
    () => undefined,
  )
  expect(result).toEqual({
    status: 'failed',
    count: 1,
    persisted: true,
    mutation: { kind: 'tasksCleanup', id: 'private-id', vault: '/vault' },
  })
  expect(result).not.toHaveProperty('receiptId')
  expect(mock.cleanup).toHaveBeenCalledWith({
    current: expect.any(Function),
    captureUndo: true,
  })
})
