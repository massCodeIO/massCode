import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { afterEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'

const resolve = vi.hoisted(() => vi.fn())
vi.mock('@/services/api', () => ({ api: {} }))
vi.mock('../links', async importOriginal => ({
  ...(await importOriginal<object>()),
  resolveInspectorLinks: resolve,
}))
vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  ipc: { on: vi.fn(), removeListener: vi.fn() },
}))
vi.mock('@/utils', () => ({ isMac: true }))
vi.mock('@/components/ui/shadcn/button', () => ({
  Button: { template: '<button><slot /></button>' },
}))
vi.mock('@/components/ui/shadcn/input', () => ({
  Input: { template: '<input />' },
}))
Object.assign(globalThis, Vue)
let app: Vue.App | undefined
interface Node {
  text: string
  children: Node[]
  parent?: Node
}
const node = (text = ''): Node => ({ text, children: [] })
const renderer = Vue.createRenderer<Node, Node>({
  createElement: () => node(),
  createText: node,
  createComment: () => node(),
  setText: (el, text) => {
    el.text = text
  },
  setElementText: (el, text) => {
    el.text = text
    el.children = []
  },
  parentNode: el => el.parent ?? null,
  nextSibling: el =>
    el.parent?.children[(el.parent?.children.indexOf(el) ?? -1) + 1] ?? null,
  patchProp: () => {},
  insert(el, parent, anchor) {
    if (el.parent)
      el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
  },
  remove(el) {
    el.parent?.children.splice(el.parent.children.indexOf(el), 1)
  },
})
const text = (el: Node): string => el.text + el.children.map(text).join('')
let host: Node
let inspectorState: {
  loading: Vue.Ref<boolean>
  showLoading: Vue.ComputedRef<boolean>
}

afterEach(() => {
  app?.unmount()
  vi.useRealTimers()
})

it('updates occurrences immediately while typing and resolves renamed objects after a local save', async () => {
  vi.useFakeTimers()
  const item = {
    type: 'note',
    id: 1,
    name: 'Before',
    folder: null,
    isDeleted: 0,
  }
  resolve.mockImplementation(async () => new Map([['note:1', { ...item }]]))
  const { default: Inspector } = await import('../Inspector.vue')
  const props = Vue.reactive({
    noteId: 2,
    content: '[[note:1]]',
    disabled: false,
    canCreate: true,
  })
  app = renderer.createApp({
    setup() {
      const state = (
        Inspector as unknown as {
          setup: (
            props: object,
            context: object,
          ) => {
            loading: Vue.Ref<boolean>
            showLoading: Vue.ComputedRef<boolean>
            rows: Vue.ComputedRef<
              Array<{ name: string, occurrences: unknown[] }>
            >
          }
        }
      ).setup(props, { expose: () => {} })
      inspectorState = state
      return () =>
        Vue.h(
          'div',
          state.rows.value
            .map(row => `${row.name} ×${row.occurrences.length}`)
            .join(' '),
        )
    },
  })
  app.provide(Vue.ssrContextKey, {})
  app.component('UiText', { template: '<span><slot /></span>' })
  app.component('UiActionButton', { template: '<button><slot /></button>' })
  host = node()
  app.mount(host)
  await Vue.nextTick()
  await Vue.nextTick()
  expect(text(host)).toContain('Before')
  props.content += ' [[note:1]] [[masscode:planned:snippet|Planned example]]'
  await Vue.nextTick()
  expect(text(host)).toContain('×2')
  expect(text(host)).toContain('Planned example')
  props.content = '[[note:1]]'
  await Vue.nextTick()
  expect(text(host)).not.toContain('Planned example')
  item.name = 'After rename'
  markPersistedStorageMutation()
  await vi.advanceTimersByTimeAsync(201)
  await Vue.nextTick()
  expect(text(host)).toContain('After rename')
  let finishRefresh!: (value: Map<string, typeof item>) => void
  resolve.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRefresh = resolve
      }),
  )
  markPersistedStorageMutation()
  await vi.advanceTimersByTimeAsync(201)
  expect(inspectorState.loading.value).toBe(true)
  expect(inspectorState.showLoading.value).toBe(false)
  expect(text(host)).toContain('After rename')
  finishRefresh(new Map([['note:1', { ...item, name: 'Synced name' }]]))
  await Vue.nextTick()
  await Vue.nextTick()
  expect(inspectorState.loading.value).toBe(false)
  expect(text(host)).toContain('Synced name')
})
