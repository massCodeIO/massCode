import type { Ref } from 'vue'
import type { TreeNode } from '../types'
import fs from 'node:fs'
import { compileFunction } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  provide,
  reactive,
  ref,
  ssrContextKey,
  watch,
} from 'vue'
import { compileTemplate, parse } from 'vue/compiler-sfc'
import { treeInjectionKey } from '../keys'

Object.assign(globalThis, { computed, ref, watch, provide, nextTick })
const cleanup: Array<() => void> = []
const filename = new URL('../Tree.vue', import.meta.url).pathname
const descriptor = parse(fs.readFileSync(filename, 'utf8')).descriptor
const template = compileTemplate({
  source: descriptor.template!.content,
  filename,
  id: 'tree-drop-regression',
  compilerOptions: { mode: 'function' },
})
// Use the actual template listeners: a setup-only test misses capture cleanup.
const renderTemplate = compileFunction(template.code, ['Vue'])(Vue)
const outside = vi.hoisted(() => ({
  callback: undefined as undefined | (() => void),
}))
vi.mock('@vueuse/core', async () => {
  const { computed, ref } = await import('vue')
  return {
    onClickOutside: (_target: unknown, callback: () => void) => {
      outside.callback = callback
    },
    useVirtualList: (rows: { value: unknown[] }) => {
      const start = ref(0)
      const container = ref({ scrollTop: 0, clientHeight: 230 })
      return {
        list: computed(() =>
          rows.value
            .slice(start.value, start.value + 26)
            .map((data, index) => ({ data, index: start.value + index })),
        ),
        containerProps: {
          ref: container,
          onScroll: () => {
            start.value = Math.floor(container.value.scrollTop / 23)
          },
        },
      }
    },
  }
})
vi.mock('../TreeNode.vue', () => ({ default: {} }))

async function setup(
  nodes?: TreeNode[],
  sharedFocus?: Ref<number | undefined>,
) {
  const Tree = (await import('../Tree.vue')).default
  const props = reactive({
    virtual: true,
    modelValue:
      nodes
      ?? (Array.from({ length: 10000 }, (_, id) => ({
        id,
        label: String(id),
      })) as TreeNode[]),
    selectedIds: [0, 9000],
    editableId: null as number | null,
    focusedId: sharedFocus ?? ref<number>(),
    highlightedIds: new Set<number>(),
    indent: 10,
  })
  let bindings: any
  let rootVNode: Vue.VNode
  const events: unknown[][] = []
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
      components: { TreeNodeComponent: { render: () => null } },
      setup() {
        bindings = Tree.setup!(
          props as never,
          {
            expose() {},
            emit: (...args: unknown[]) => {
              events.push(args)
              if (args[0] === 'update:focusedId' && sharedFocus)
                sharedFocus.value = args[1] as number | undefined
            },
          } as never,
        )
        const context = Vue.proxyRefs({
          ...Vue.toRefs(props),
          ...bindings,
          $slots: {},
        })
        return () => {
          rootVNode = renderTemplate(context, [])
          return null
        }
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  const injection = (app as any)._instance.provides[treeInjectionKey as symbol]
  cleanup.push(() => app.unmount())
  return {
    props,
    bindings,
    injection,
    events,
    clickOutside: outside.callback!,
    captureDrop: () => rootVNode.props?.onDropCapture?.(new Event('drop')),
  }
}

afterEach(() => cleanup.splice(0).forEach(dispose => dispose()))

describe('virtual tree interaction state', () => {
  it('keeps the offscreen source through drop capture until native dragend', async () => {
    const { bindings, injection, props, events, captureDrop } = await setup()
    bindings.scrollToId(9000)
    injection.dragSourceChanged(9000)
    await nextTick()
    bindings.scrollToId(0)
    await nextTick()
    captureDrop()
    // Native event delivery can drain microtasks between capture and target
    // listeners. Removing the pinned source here also clears its drag store.
    await new Promise<void>(resolve => queueMicrotask(resolve))
    await nextTick()
    expect(
      bindings.renderedRows.value.some((row: any) => row.node.id === 9000),
    ).toBe(true)
    injection.dragNode([props.modelValue[9000]], props.modelValue[0], 'center')
    expect(events).toContainEqual([
      'dragNode',
      {
        nodes: [props.modelValue[9000]],
        target: props.modelValue[0],
        position: 'center',
      },
    ])
    injection.dragSourceChanged(undefined)
    await nextTick()
    expect(
      bindings.renderedRows.value.some((row: any) => row.node.id === 9000),
    ).toBe(false)
  })

  it('leaves another tree shared focus intact on refresh and inside/outside clicks', async () => {
    const focusedId = ref<number | undefined>(999)
    const live = await setup([{ id: 999, label: 'Live' }], focusedId)
    const trash = await setup([{ id: 1000, label: 'Trash' }], focusedId)
    trash.props.modelValue = [{ id: 1001, label: 'Other trash' }]
    await nextTick()
    trash.bindings.clearOffscreenInteraction()
    trash.clickOutside()
    expect(focusedId.value).toBe(999)
    expect(trash.events).not.toContainEqual(['update:focusedId', undefined])
    live.props.modelValue = []
    await nextTick()
    expect(focusedId.value).toBeUndefined()
    expect(live.events).toContainEqual(['update:focusedId', undefined])
  })

  it('keeps full selection source, edit and actual drag row when scrolling', async () => {
    const { props, bindings, injection, events } = await setup()
    expect(injection.rootNodes.value).toHaveLength(10000)
    props.editableId = 20
    injection.dragSourceChanged(9000)
    await nextTick()
    bindings.scrollToId(5000)
    await nextTick()
    const ids = bindings.renderedRows.value.map((row: any) => row.node.id)
    expect(ids).toContain(20)
    expect(ids).toContain(9000)
    expect(ids).not.toContain(0)
    expect(ids.length).toBeLessThanOrEqual(28)
    expect(props.selectedIds).toEqual([0, 9000])
    expect(events).not.toContainEqual(['update:editableId', null])
    injection.dragSourceChanged(undefined)
    await nextTick()
    expect(
      bindings.renderedRows.value.some((row: any) => row.node.id === 9000),
    ).toBe(false)
  })

  it('scrolls programmatic edit, clamps shrink, clears only stale offscreen interaction on inside click', async () => {
    const { props, bindings, events } = await setup()
    props.editableId = 9000
    await nextTick()
    await nextTick()
    expect(bindings.containerRef.value.scrollTop).toBeGreaterThan(200000)
    props.focusedId = 0
    props.highlightedIds.add(0)
    bindings.clearOffscreenInteraction()
    expect(events).toContainEqual(['update:focusedId', undefined])
    expect(props.highlightedIds.size).toBe(0)
    props.modelValue = props.modelValue.slice(0, 5)
    await nextTick()
    expect(bindings.containerRef.value.scrollTop).toBe(0)
    expect(events).toContainEqual(['update:editableId', null])
    outside.callback!()
    expect(events).toContainEqual(['update:focusedId', undefined])
  })
})
