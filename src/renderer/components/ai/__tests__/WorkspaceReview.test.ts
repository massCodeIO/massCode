import { expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  reactive,
  ref,
  ssrContextKey,
} from 'vue'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  ipc: { invoke },
}))
vi.mock('@/composables/spaces/http/useHttpRuntime', () => ({
  useHttpRuntime: () => ({ requestDirty: { value: false } }),
}))
vi.mock('@/composables/ai/useAi', () => ({
  useAi: () => ({
    setWorkspaceItems: (message: any, items: any[]) => {
      message.workspaceItems = items
    },
    setWorkspaceApplied: (message: any, indexes: number[]) => {
      message.workspaceApplied = indexes
      message.applied
        = indexes.length === message.workspaceProposal.changes.length
    },
  }),
}))
vi.mock('@/components/ui/shadcn/button', () => ({ Button: {} }))
vi.mock('@/components/ui/shadcn/checkbox', () => ({ Checkbox: {} }))
vi.mock('@/components/ui/shadcn/dialog', () => ({}))

it('replaces the cumulative receipt when preview operations are applied in two batches', async () => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
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
  let state: any
  const message = reactive({
    workspaceProposal: {
      id: 'proposal',
      changes: [{ operation: { fields: {} } }, { operation: { fields: {} } }],
    },
    workspaceApplied: [] as number[],
    workspaceItems: [] as any[],
    applied: false,
  })
  const component = (await import('../WorkspaceReview.vue')).default
  const app = renderer.createApp(
    defineComponent({
      setup() {
        state = (component as any).setup({ message }, { expose() {} })
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  try {
    app.mount({})
    const items = [
      { id: 1, operationIndex: 0 },
      { id: 2, operationIndex: 1 },
    ]
    invoke.mockResolvedValueOnce({
      ok: true,
      data: { applied: [0], items: items.slice(0, 1) },
    })
    state.selected.value = [0]
    await state.apply()
    invoke.mockResolvedValueOnce({
      ok: true,
      data: { applied: [0, 1], items },
    })
    state.selected.value = [1]
    await state.apply()
    expect(message.workspaceApplied).toEqual([0, 1])
    expect(message.workspaceItems).toEqual(items)
    expect(message.applied).toBe(true)
    expect(state.pending.value).toBe(false)
  }
  finally {
    app.unmount()
    vi.unstubAllGlobals()
  }
})
