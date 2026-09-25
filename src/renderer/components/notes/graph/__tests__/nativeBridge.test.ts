import { expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  ssrContextKey,
} from 'vue'
import Canvas from '../Canvas.vue'

Object.assign(globalThis, {
  computed,
  ref,
  nextTick,
  onMounted,
  onBeforeUnmount,
})
const mock = vi.hoisted(() => ({
  graph: {
    graphData: { value: null },
    graphError: { value: null },
    isGraphLoading: { value: true },
    getNotesGraph: vi.fn(),
  },
  register: vi.fn(),
}))
vi.mock('@/composables', () => ({
  useNotesGraph: () => mock.graph,
  useNotesWorkspaceNavigation: () => ({}),
  useTheme: () => ({ isDark: ref(false) }),
}))
vi.mock('@/composables/ai/nativeBridges', () => ({
  registerNativeBridge: mock.register,
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('@/components/ui/shadcn/button', () => ({ Button: {} }))
it.each([false, true])(
  'awaits loading and fresh Scene before native movement (unmounted=%s)',
  async (unmounted) => {
    let finish!: () => void
    const loading = new Promise<void>((resolve) => {
      finish = resolve
    })
    mock.graph.isGraphLoading.value = true
    mock.graph.getNotesGraph.mockReturnValue(loading)
    mock.register.mockReset().mockReturnValue(vi.fn())
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
          bindings = Canvas.setup!({} as never, { expose() {} } as never)
          return () => null
        },
      }),
    )
    app.provide(ssrContextKey, {})
    app.mount({})
    const oldMove = vi.fn(() => true)
    const newMove = vi.fn(() => true)
    bindings.graphSceneRef.value = { moveNode: oldMove }
    const handler = mock.register.mock.calls[0][1]
    const pending = handler(
      {
        action: 'notesGraph',
        command: { kind: 'moveNode', noteId: 1127, dx: 10, dy: 20 },
      },
      () => true,
    )
    expect(oldMove).not.toHaveBeenCalled()
    if (unmounted)
      app.unmount()
    bindings.graphSceneRef.value = { moveNode: newMove }
    mock.graph.isGraphLoading.value = false
    finish()
    expect(await pending).toMatchObject({
      status: unmounted ? 'stale' : 'done',
    })
    expect(oldMove).not.toHaveBeenCalled()
    expect(newMove).toHaveBeenCalledTimes(unmounted ? 0 : 1)
    if (!unmounted) {
      expect(newMove).toHaveBeenCalledWith(1127, 10, 20)
      app.unmount()
    }
  },
)
