import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  inject,
  nextTick,
  onBeforeUnmount,
  ref,
  ssrContextKey,
  watch,
} from 'vue'
import { dragStore } from '../composables'
import { treeInjectionKey } from '../keys'

Object.assign(globalThis, {
  computed,
  inject,
  ref,
  watch,
  nextTick,
  onBeforeUnmount,
})
vi.mock('@vueuse/core', () => ({ onClickOutside() {} }))
const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach(dispose => dispose())
  vi.unstubAllGlobals()
})

async function setup(allowed = true) {
  const TreeNode = (await import('../TreeNode.vue')).default
  const nodes = [
    { id: 1, label: 'First selected' },
    { id: 2, label: 'Actual source' },
  ]
  const pin = vi.fn()
  const focusedId = ref<number>()
  const highlightedIds = ref(new Set<string | number>())
  const editableId = ref<number | null>(2)
  const focus = vi.fn()
  const select = vi.fn()
  let bindings: any
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
        bindings = TreeNode.setup!(
          {
            node: nodes[1],
            nodes,
            index: 1,
            deep: 0,
            indent: 10,
            renderChildren: false,
          } as never,
          { expose() {} } as never,
        )
        bindings.editInputRef.value = { focus, select }
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.provide(treeInjectionKey, {
    rootNodes: ref(nodes),
    selectedIds: ref([1, 2]),
    editableId,
    focusedId,
    highlightedIds,
    canDrag: () => allowed,
    dragSourceChanged: pin,
    isHoveredByIdDisabled: ref(false),
    clickNode: vi.fn(),
    dblclickNode: vi.fn(),
    dragNode: vi.fn(),
    externalDrop: vi.fn(),
    toggleNode: vi.fn(),
    contextMenu: vi.fn(),
    updateLabel: vi.fn(),
    cancelEdit: vi.fn(),
  })
  app.mount({})
  cleanup.push(() => app.unmount())
  vi.stubGlobal('document', {
    createElement: () => ({ appendChild() {}, remove() {} }),
    body: { appendChild() {} },
  })
  return { bindings, pin, app, focus, select }
}

describe('virtual row existing interactions', () => {
  it('pins the accepted native source rather than first selected node and cleans drag on unmount', async () => {
    const { bindings, pin, app, focus, select } = await setup()
    await nextTick()
    expect(focus).toHaveBeenCalledOnce()
    expect(select).toHaveBeenCalledOnce()
    bindings.onDragStart({ dataTransfer: { setDragImage() {}, setData() {} } })
    expect(dragStore.dragNode?.id).toBe(1)
    expect(pin).toHaveBeenLastCalledWith(2)
    app.unmount()
    expect(pin).toHaveBeenLastCalledWith(undefined)
    expect(dragStore.dragNode).toBeUndefined()
    expect(dragStore.dragNodes).toBeUndefined()
  })

  it('does not pin a rejected drag', async () => {
    const { bindings, pin } = await setup(false)
    const preventDefault = vi.fn()
    bindings.onDragStart({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(pin).not.toHaveBeenCalled()
  })
})
