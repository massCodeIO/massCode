import { expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  ssrContextKey,
  triggerRef,
  watch,
} from 'vue'
import { aiNativeActionSchema } from '~/shared/aiNativeActions'
import Scene from '../Scene.vue'

Object.assign(globalThis, {
  computed,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  triggerRef,
  watch,
})
vi.mock('@/composables', () => ({ useTheme: () => ({ isDark: ref(false) }) }))
it('moves an existing graph node temporarily without navigation or fixed coordinates', async () => {
  vi.stubGlobal('window', {
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
  })
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
  let exposed: any
  const emit = vi.fn()
  const app = renderer.createApp(
    defineComponent({
      setup() {
        bindings = Scene.setup!(
          {
            compact: false,
            edges: [],
            width: 600,
            height: 400,
            nodes: [{ id: 7, name: 'Node', degree: 0 }],
          } as never,
          {
            emit,
            expose: (value: unknown) => {
              exposed = value
            },
          } as never,
        )
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    bindings.stopSimulation()
    const node = bindings.sceneNodes.value[0]
    const before = { x: node.x, y: node.y }
    expect(exposed.moveNode(7, 30, -20)).toBe(true)
    expect(node).toMatchObject({
      x: before.x + 30,
      y: before.y - 20,
      fx: null,
      fy: null,
    })
    expect(emit).not.toHaveBeenCalled()
    expect(exposed.moveNode(999, 1, 1)).toBe(false)
    expect(exposed.moveNode(7, Number.NaN, 1)).toBe(false)
    expect(exposed.moveNode(7, 10001, 1)).toBe(false)
    expect(
      aiNativeActionSchema.safeParse({
        action: 'notesGraph',
        command: { kind: 'moveNode', noteId: 7, dx: 30, dy: -20 },
      }).success,
    ).toBe(true)
    expect(
      aiNativeActionSchema.safeParse({
        action: 'notesGraph',
        command: { kind: 'moveNode', noteId: 7, dx: Infinity, dy: 0 },
      }).success,
    ).toBe(false)
    await nextTick()
  }
  finally {
    app.unmount()
    vi.unstubAllGlobals()
  }
})
