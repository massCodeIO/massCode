import { redo, undo, undoDepth } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { language } from '@codemirror/language'
import { EditorSelection, EditorState } from '@codemirror/state'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
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
  loadLanguage: vi.fn(),
  created: vi.fn(),
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
  onBeforeUnmount,
  useTemplateRef: () => ref(null),
})
vi.mock('@/composables', () => ({
  useApp: () => mock.app,
  useSnippets: () => mock.snippets,
  useEditor: () => ({ settings: { fontSize: 14 }, cursorPosition: {} }),
  useTheme: () => ({ editorThemeName: ref('light'), isDark: ref(false) }),
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
  ipc: {
    invoke: mock.invoke,
    on: vi.fn(),
    off: vi.fn(),
    removeListeners: vi.fn(),
  },
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
vi.mock('../grammars', () => ({ loadLanguageSupport: mock.loadLanguage }))
vi.mock('@codemirror/view', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codemirror/view')>()
  class MockEditorView {
    constructor(config: any) {
      mock.created(config.state)
      mock.source = config.state.doc.toString()
      mock.cm.state = config.state
      return mock.cm
    }
  }
  Object.setPrototypeOf(MockEditorView, actual.EditorView)
  return { ...actual, EditorView: MockEditorView }
})
beforeEach(() => {
  vi.clearAllMocks()
  mock.loadLanguage.mockResolvedValue(undefined)
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
    selectedSnippet: ref({ ...snippet.value }),
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
    state: EditorState.create({ doc: mock.source }),
    scrollDOM: { scrollLeft: 0, scrollTop: 0, scrollTo: vi.fn() },
    dispatch: vi.fn((spec) => {
      if (mock.source !== mock.cm.state.doc.toString())
        mock.cm.state = EditorState.create({ doc: mock.source })
      mock.cm.state = mock.cm.state.update(spec).state
      mock.source = mock.cm.state.doc.toString()
    }),
    setState: vi.fn((state) => {
      mock.cm.state = state
      mock.source = state.doc.toString()
    }),
    destroy: vi.fn(),
    requestMeasure: vi.fn(),
  }
  mock.invoke.mockResolvedValue('const x = 1;\n')
  mock.flush.mockResolvedValue(undefined)
})
async function setup(initialize = true) {
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
  if (initialize)
    await bindings.init()
  mock.cm.dispatch.mockClear()
  return { bindings, app }
}
it.each(['sh', 'dockerfile', 'java', 'xml', 'jade'])(
  'does not invoke or mutate unsupported %s',
  async (language) => {
    const { bindings, app } = await setup()
    mock.snippets.selectedSnippetContent.value.language = language
    expect(await bindings.formatCurrent()).toEqual({ status: 'unavailable' })
    expect(mock.invoke).not.toHaveBeenCalled()
    expect(mock.cm.dispatch).not.toHaveBeenCalled()
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
    expect(mock.cm.dispatch).not.toHaveBeenCalled()
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
  expect(mock.cm.dispatch).not.toHaveBeenCalled()
  expect(mock.flush).not.toHaveBeenCalled()
  expect(mock.sonner).toHaveBeenCalledWith({
    type: 'error',
    message: 'messages:error.formatFailed',
  })
  log.mockRestore()
  app.unmount()
})

it('keeps formatting undoable and resets history even when the next fragment has identical text', async () => {
  const { bindings, app } = await setup()
  await bindings.formatCurrent()
  expect(mock.source).toBe('const x = 1;\n')
  expect(undo(mock.cm)).toBe(true)
  expect(mock.source).toBe('const x=1')
  expect(redo(mock.cm)).toBe(true)
  expect(mock.source).toBe('const x = 1;\n')
  bindings.setValue(mock.source, true, false)
  expect(undoDepth(mock.cm.state)).toBe(0)
  expect(mock.cm.state.selection.main.head).toBe(0)
  app.unmount()
})
it('preserves clamped selection and viewport on same-fragment external updates', async () => {
  const { bindings, app } = await setup()
  mock.cm.dispatch({ selection: { anchor: 4, head: 9 } })
  mock.cm.scrollDOM.scrollLeft = 12
  mock.cm.scrollDOM.scrollTop = 90
  bindings.setValue('short', true, true)
  expect(mock.cm.state.selection.main.anchor).toBe(4)
  expect(mock.cm.state.selection.main.head).toBe(5)
  expect(mock.cm.scrollDOM.scrollTo).toHaveBeenLastCalledWith(12, 90)
  expect(undoDepth(mock.cm.state)).toBe(0)
  app.unmount()
})

it('isolates an AI edit from adjacent user edits in undo history', async () => {
  const { bindings, app } = await setup()
  mock.cm.dispatch({ changes: { from: mock.source.length, insert: ';' } })
  const before = mock.source
  expect(
    await bindings.applyAiEdit(
      {
        space: 'code',
        snippetId: 1,
        contentId: 2,
        contextId: 'edit',
        text: before,
        from: 6,
        to: 7,
        vault: 'one',
      },
      'result',
    ),
  ).toBe(true)
  expect(mock.source).toBe('const result=1;')
  mock.cm.dispatch({ changes: { from: mock.source.length, insert: '\n' } })
  expect(undo(mock.cm)).toBe(true)
  expect(mock.source).toBe('const result=1;')
  expect(undo(mock.cm)).toBe(true)
  expect(mock.source).toBe(before)
  expect(undo(mock.cm)).toBe(true)
  expect(mock.source).toBe('const x=1')
  app.unmount()
})

it('keeps multiple selections and applies an edit to every range', async () => {
  const { bindings, app } = await setup()
  expect(mock.cm.state.facet(EditorState.allowMultipleSelections)).toBe(true)
  mock.cm.dispatch({
    selection: EditorSelection.create([
      EditorSelection.range(0, 5),
      EditorSelection.range(6, 7),
    ]),
  })
  expect(mock.cm.state.selection.ranges).toHaveLength(2)
  bindings.setValue('const y=2', true, true)
  expect(mock.cm.state.selection.ranges).toHaveLength(2)
  mock.cm.dispatch(mock.cm.state.replaceSelection('_'))
  expect(mock.source).toBe('_ _=2')
  expect(undo(mock.cm)).toBe(true)
  expect(mock.source).toBe('const y=2')
  app.unmount()
})

function delayedLanguage() {
  let resolve!: (value: ReturnType<typeof json> | undefined) => void
  const promise = new Promise<ReturnType<typeof json> | undefined>((done) => {
    resolve = done
  })
  mock.loadLanguage.mockReturnValueOnce(promise)
  return resolve
}
function selectContent(id: number, value: string, language = 'json') {
  mock.snippets.displayedSnippetContent.value = {
    id,
    value,
    label: 'B',
    language,
  }
}
it('keeps the colored previous document inert until the next language is ready', async () => {
  mock.loadLanguage.mockResolvedValueOnce(json())
  const { bindings, app } = await setup()
  const originalLanguage = mock.cm.state.facet(language)
  const resolve = delayedLanguage()
  selectContent(3, '{"next":true}', 'new-language')
  const pending = bindings.applyDisplayedContent()
  expect(mock.cm.state.doc.toString()).toBe('const x=1')
  expect(mock.cm.state.facet(language)).toBe(originalLanguage)
  expect(bindings.isSelectedSnippetContentReady.value).toBe(false)
  expect(bindings.readAiContext()).toBeUndefined()
  mock.cm.dispatch({ changes: { from: 0, insert: 'blocked' } })
  expect(mock.cm.state.doc.toString()).toBe('const x=1')
  bindings.saveEditorContent()
  expect(mock.queue).not.toHaveBeenCalled()
  const support = json()
  resolve(support)
  await pending
  expect(mock.cm.state.doc.toString()).toBe('{"next":true}')
  expect(mock.cm.state.facet(language)).toBe(support.language)
  expect(mock.cm.setState).toHaveBeenCalledTimes(1)
  expect(bindings.isSelectedSnippetContentReady.value).toBe(true)
  app.unmount()
})
it('publishes only the latest fragment when language requests finish out of order', async () => {
  const { bindings, app } = await setup()
  const finishB = delayedLanguage()
  selectContent(3, 'B')
  const b = bindings.applyDisplayedContent()
  selectContent(4, 'C', 'plain_text')
  await bindings.applyDisplayedContent()
  finishB(json())
  await b
  expect(mock.cm.state.doc.toString()).toBe('C')
  expect(mock.cm.state.facet(language)).toBeNull()
  expect(mock.cm.setState).toHaveBeenCalledTimes(1)
  expect(bindings.readAiContext().contentId).toBe(4)
  app.unmount()
})
it('does not create an unhighlighted initial view and handles a selection during cold loading', async () => {
  const { bindings, app } = await setup(false)
  const finishInitial = delayedLanguage()
  const initial = bindings.init()
  expect(mock.created).not.toHaveBeenCalled()
  selectContent(3, '{"new":1}')
  const support = json()
  mock.loadLanguage.mockResolvedValueOnce(support)
  await bindings.applyDisplayedContent()
  expect(mock.created).toHaveBeenCalledTimes(1)
  const initialState = mock.created.mock.calls[0]![0]
  expect(initialState.doc.toString()).toBe('{"new":1}')
  expect(initialState.facet(language)).toBe(support.language)
  finishInitial(undefined)
  await initial
  expect(mock.created).toHaveBeenCalledTimes(1)
  expect(mock.cm.state.doc.toString()).toBe('{"new":1}')
  app.unmount()
})
it('retains edits and undo history during a same-fragment language change', async () => {
  const { bindings, app } = await setup()
  const finish = delayedLanguage()
  selectContent(2, mock.source)
  const pending = bindings.applyDisplayedContent()
  expect(bindings.isSelectedSnippetContentReady.value).toBe(true)
  mock.cm.dispatch({ changes: { from: mock.source.length, insert: ';' } })
  const support = json()
  finish(support)
  await pending
  expect(mock.source).toBe('const x=1;')
  expect(mock.cm.state.facet(language)).toBe(support.language)
  expect(mock.cm.setState).not.toHaveBeenCalled()
  expect(undo(mock.cm)).toBe(true)
  expect(mock.source).toBe('const x=1')
  app.unmount()
})
it('discards a cold language completion after unmount', async () => {
  const { bindings, app } = await setup(false)
  const finish = delayedLanguage()
  const initial = bindings.init()
  app.unmount()
  finish(json())
  await initial
  expect(mock.created).not.toHaveBeenCalled()
})
it('recovers readiness after a language error and retries on the next update', async () => {
  const { bindings, app } = await setup()
  selectContent(3, 'new document')
  const failure = new Error('grammar unavailable')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  mock.loadLanguage.mockRejectedValueOnce(failure)
  await bindings.applyDisplayedContent()
  expect(log).toHaveBeenCalledWith(failure)
  log.mockRestore()
  expect(mock.source).toBe('new document')
  expect(bindings.isSelectedSnippetContentReady.value).toBe(true)
  const support = json()
  mock.loadLanguage.mockResolvedValueOnce(support)
  await bindings.applyDisplayedContent()
  expect(mock.cm.state.facet(language)).toBe(support.language)
  app.unmount()
})

it('does not publish a pending fragment after the next selection enters record loading', async () => {
  const { bindings, app } = await setup()
  const finish = delayedLanguage()
  selectContent(3, 'pending B')
  const pending = bindings.applyDisplayedContent()
  // The displayed refs retain B until the full record for C is fetched.
  mock.app.state.snippetId = 9
  mock.snippets.selectedSnippet.value = { id: 9, name: 'C' }
  mock.snippets.selectedSnippetRecordStatus.value = 'loading'
  finish(json())
  await pending
  expect(mock.source).toBe('const x=1')
  expect(mock.cm.setState).not.toHaveBeenCalled()
  expect(bindings.isSelectedSnippetContentReady.value).toBe(false)
  expect(bindings.readAiContext()).toBeUndefined()
  app.unmount()
})
it('applies an external same-fragment document and its language in one transaction', async () => {
  const { bindings, app } = await setup()
  const finish = delayedLanguage()
  selectContent(2, '{"replacement":true}')
  const pending = bindings.applyDisplayedContent()
  expect(mock.source).toBe('const x=1')
  expect(mock.cm.dispatch).not.toHaveBeenCalled()
  const support = json()
  finish(support)
  await pending
  expect(mock.source).toBe('{"replacement":true}')
  expect(mock.cm.state.facet(language)).toBe(support.language)
  expect(mock.cm.dispatch).toHaveBeenCalledTimes(1)
  expect(mock.cm.setState).not.toHaveBeenCalled()
  app.unmount()
})

it('keeps Find focus pending until the selected document and language are applied', async () => {
  const { bindings, app } = await setup()
  const focusInput = vi.fn()
  bindings.contentSearchPanelRef.value = { focusInput }
  const finish = delayedLanguage()
  selectContent(3, '{"find":true}')
  const pending = bindings.applyDisplayedContent()
  bindings.onFindMenu()
  await nextTick()
  expect(focusInput).not.toHaveBeenCalled()
  finish(json())
  await pending
  await nextTick()
  expect(focusInput).toHaveBeenCalledTimes(1)
  app.unmount()
})
