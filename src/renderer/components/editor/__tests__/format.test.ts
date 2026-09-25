import { beforeEach, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  reactive,
  ref,
  ssrContextKey,
} from 'vue'
import Editor from '../Editor.vue'

const mock = vi.hoisted(() => ({
  source: 'const x=1',
  vault: 'one',
  invoke: vi.fn(),
  flush: vi.fn(),
  queue: vi.fn(),
  sonner: vi.fn(),
  cm: {} as any,
  snippets: {} as any,
  app: {} as any,
}))
Object.assign(globalThis, {
  computed,
  ref,
  nextTick,
  watch: () => () => {},
  onMounted: () => {},
  onBeforeUnmount: () => {},
  useTemplateRef: () => ref(null),
})
vi.mock('@/composables', () => ({
  useApp: () => mock.app,
  useSnippets: () => mock.snippets,
  useEditor: () => ({ settings: { fontSize: 14 }, cursorPosition: {} }),
  useTheme: () => ({ editorThemeName: ref('light') }),
  useSnippetUpdate: () => ({
    flushSnippetContent: mock.flush,
    addToUpdateContentQueue: mock.queue,
    getPendingContentUpdate: () => undefined,
    isContentUpdateBusy: () => false,
  }),
  useResizeHandle: () => {},
  useDonations: () => ({}),
  useSonner: () => ({ sonner: mock.sonner }),
}))
vi.mock('@/composables/ai/useAi', () => ({
  useAi: () => ({
    setContext: vi.fn(),
    registerEditor: () => () => {},
    registerWorkspace: () => () => {},
  }),
}))
vi.mock('@/composables/ai/nativeBridges', () => ({
  registerNativeBridge: () => () => {},
}))
vi.mock('@/electron', () => ({
  ipc: { invoke: mock.invoke, on: vi.fn(), off: vi.fn() },
  i18n: { t: (key: string) => key },
  store: {
    preferences: {
      get: (key: string) =>
        key === 'storage.vaultPath' ? mock.vault : undefined,
    },
    app: { get: () => undefined },
  },
}))
vi.mock('@vueuse/core', () => ({
  useClipboard: () => ({}),
  useCssVar: () => ref(''),
  useDebounceFn: (fn: unknown) => fn,
  useEventListener: () => {},
  useResizeObserver: () => {},
}))
vi.mock('codemirror', () => ({ default: () => mock.cm }))
vi.mock('codemirror/addon/edit/closebrackets', () => ({}))
vi.mock('codemirror/addon/edit/matchbrackets', () => ({}))
vi.mock('codemirror/addon/selection/active-line', () => ({}))
vi.mock('codemirror/addon/scroll/simplescrollbars', () => ({}))
beforeEach(() => {
  vi.clearAllMocks()
  mock.source = 'const x=1'
  mock.vault = 'one'
  vi.stubGlobal('window', {})
  vi.stubGlobal('document', { body: {}, getElementById: () => ({}) })
  const content = ref({
    id: 2,
    label: 'A',
    value: mock.source,
    language: 'javascript',
  })
  const snippet = ref({ id: 1, name: 'Code' })
  mock.snippets = {
    displayedSnippet: snippet,
    selectedSnippet: snippet,
    displayedSnippetContent: content,
    selectedSnippetContent: content,
    selectedSnippetRecordStatus: ref('ready'),
    selectedSnippetIds: ref([1]),
    isEmpty: ref(false),
    isSearch: ref(false),
    searchQuery: ref(''),
    isAvailableToCodePreview: ref(false),
  }
  mock.app = {
    state: reactive({ snippetId: 1 }),
    isShowCodePreview: ref(false),
    isShowCodeImage: ref(false),
    isShowJsonVisualizer: ref(false),
    isFocusedSearch: ref(false),
  }
  mock.cm = {
    on: vi.fn(),
    getValue: () => mock.source,
    getSelection: () => '',
    listSelections: () => [{}],
    indexFromPos: () => 0,
    getCursor: () => ({ line: 0, ch: 0 }),
    getScrollInfo: () => ({ left: 0, top: 0 }),
    setValue: vi.fn((value) => {
      mock.source = value
    }),
    setCursor: vi.fn(),
    scrollTo: vi.fn(),
    refresh: vi.fn(),
  }
  mock.invoke.mockResolvedValue('const x = 1;\n')
  mock.flush.mockResolvedValue(undefined)
})
async function setup() {
  const renderer = createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
  })
  let bindings: any
  const app = renderer.createApp(
    defineComponent({
      setup() {
        bindings = Editor.setup!({} as never, { expose() {} } as never)
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  await bindings.init()
  return { bindings, app }
}
it.each(['sh', 'dockerfile', 'java', 'xml', 'jade'])(
  'does not invoke or mutate unsupported %s',
  async (language) => {
    const { bindings, app } = await setup()
    mock.snippets.selectedSnippetContent.value.language = language
    expect(await bindings.formatCurrent()).toEqual({ status: 'unavailable' })
    expect(mock.invoke).not.toHaveBeenCalled()
    expect(mock.cm.setValue).not.toHaveBeenCalled()
    expect(mock.flush).not.toHaveBeenCalled()
    app.unmount()
  },
)
it.each(['language', 'vault'])(
  'discards a formatter completion after %s changed',
  async (field) => {
    const { bindings, app } = await setup()
    let finish!: (value: string) => void
    mock.invoke.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve
      }),
    )
    const pending = bindings.formatCurrent()
    if (field === 'vault')
      mock.vault = 'two'
    else mock.snippets.selectedSnippetContent.value.language = 'typescript'
    finish('const x = 1;\n')
    expect(await pending).toBeUndefined()
    expect(mock.cm.setValue).not.toHaveBeenCalled()
    expect(mock.flush).not.toHaveBeenCalled()
    app.unmount()
  },
)
it('reports done only after persistence and exposes a save failure instead', async () => {
  const { bindings, app } = await setup()
  let persisted!: () => void
  mock.flush.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      persisted = resolve
    }),
  )
  let done = false
  const pending = bindings.formatCurrent().then((result: unknown) => {
    done = true
    return result
  })
  await vi.waitFor(() => expect(mock.flush).toHaveBeenCalledWith(1, 2))
  expect(done).toBe(false)
  persisted()
  expect(await pending).toMatchObject({
    status: 'done',
    persisted: true,
    mutation: { kind: 'editor' },
  })
  mock.source = 'const x=1'
  mock.flush.mockRejectedValueOnce(new Error('disk'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await bindings.formatCurrent()).toMatchObject({ status: 'failed' })
  log.mockRestore()
  app.unmount()
})
it('keeps source unchanged on parse failure and notifies a manual caller', async () => {
  const { bindings, app } = await setup()
  mock.invoke.mockRejectedValueOnce(new Error('parse'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await bindings.format()).toMatchObject({ status: 'failed' })
  expect(mock.source).toBe('const x=1')
  expect(mock.cm.setValue).not.toHaveBeenCalled()
  expect(mock.flush).not.toHaveBeenCalled()
  expect(mock.sonner).toHaveBeenCalledWith({
    type: 'error',
    message: 'messages:error.formatFailed',
  })
  log.mockRestore()
  app.unmount()
})
