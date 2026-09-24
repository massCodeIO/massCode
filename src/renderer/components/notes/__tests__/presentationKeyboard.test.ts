import { expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  ssrContextKey,
  watch,
} from 'vue'

const mocks = vi.hoisted(() => ({
  keydown: undefined as unknown as (event: KeyboardEvent) => void,
  select: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/components/editor/markdown/composables', () => ({
  useMarkdown: () => ({ scaleToShow: ref(100), onZoom() {} }),
}))
vi.mock('@/composables', () => ({
  useNoteSearch: () => ({ displayedNotes: ref([{ id: 1 }, { id: 2 }]) }),
  useNotes: () => ({
    selectedNote: ref({ id: 1, content: '# One' }),
    selectNote: mocks.select,
    isNotesLoading: ref(false),
    refreshSelectedNote() {},
    selectedNoteRecordStatus: ref('ready'),
  }),
  useNotesApp: () => ({
    hideNotesViewModes() {},
    isNotesPresentationShown: ref(true),
    showAllNotesPanels() {},
    showNotesPresentation() {},
  }),
  useNotesSpaceInitialization: () => ({ initNotesSpace: async () => {} }),
}))
vi.mock('@/composables/ai/nativeActions', () => ({
  readNativeState: () => ({}),
}))
vi.mock('@/composables/ai/nativeBridges', () => ({
  registerNativeBridge: () => () => {},
}))
vi.mock('@/composables/useNavigationHistory', () => ({
  useNavigationHistory: () => ({
    recordNavigation: (action: () => void) => action(),
  }),
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('@/router', () => ({
  router: { push: mocks.push },
  RouterName: { notesSpace: 'notes' },
}))
vi.mock('@vueuse/core', () => ({
  useFullscreen: () => ({
    isFullscreen: ref(false),
    toggle() {},
    enter() {},
    exit() {},
  }),
  useEventListener: (
    _name: string,
    handler: (event: KeyboardEvent) => void,
  ) => {
    mocks.keydown = handler
  },
}))

it('keeps presentation shortcuts out of editable chat controls and handles native keys once', async () => {
  class Element {
    constructor(
      public editable = false,
      public control = false,
    ) {}

    get isContentEditable() {
      return this.editable
    }

    closest() {
      return this.control ? this : null
    }
  }
  Object.entries({
    computed,
    ref,
    watch,
    onMounted,
    onBeforeUnmount,
    onUnmounted,
    nextTick,
    HTMLElement: Element,
  }).forEach(([key, value]) => vi.stubGlobal(key, value))
  const component = (await import('../NotesPresentation.vue')).default
  let state: any
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
  const app = renderer.createApp(
    defineComponent({
      setup() {
        state = (component as any).setup({}, { expose() {} })
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  const key = (key: string, extra = {}) =>
    mocks.keydown({ key, target: new Element(), ...extra } as KeyboardEvent)
  try {
    app.mount({})
    await nextTick()
    for (const target of [new Element(true), new Element(false, true)]) {
      key('ArrowRight', { target })
      key('Escape', { target })
      key('l', { target, metaKey: true })
    }
    key('ArrowRight', { defaultPrevented: true })
    key('ArrowRight', { isComposing: true })
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(state.isLaserPointerActive.value).toBe(false)
    key('ArrowRight')
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith(2)
    key('l', { metaKey: true })
    expect(state.isLaserPointerActive.value).toBe(true)
    key('l', { metaKey: true, repeat: true })
    expect(state.isLaserPointerActive.value).toBe(true)
    key('L', { ctrlKey: true })
    expect(state.isLaserPointerActive.value).toBe(false)
    key('Escape')
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith({ name: 'notes' })
  }
  finally {
    app.unmount()
    vi.unstubAllGlobals()
  }
})
