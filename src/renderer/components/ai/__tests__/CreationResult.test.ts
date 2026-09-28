import { expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  ref,
  ssrContextKey,
} from 'vue'

vi.mock('@/composables/ai/useAi', () => ({
  useAi: () => ({ markWorkspaceUndone: vi.fn() }),
}))
vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  ipc: { invoke: vi.fn() },
}))
vi.mock('@/components/ui/shadcn/button', () => ({ Button: {} }))

function setupComponent(component: any, message: unknown) {
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
        state = component.setup(
          { message: {}, creation: message },
          { expose() {} },
        )
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  app.unmount()
  return state
}

it('distinguishes created, failed, unattempted and undone rows in a partial batch', async () => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  try {
    const component = (await import('../CreationResult.vue')).default
    const message = {
      proposal: {
        changes: ['One', 'Two', 'Three'].map(name => ({
          name,
          operation: { kind: 'item', space: 'notes', fields: {} },
        })),
      },
      applied: [0],
      failedOperationIndex: 1,
      undone: [] as number[],
      items: [],
    }
    const state = setupComponent(component, message)
    expect(state.rows.value.map((row: any) => row.label)).toEqual([
      'ai.workspace.createdNotes',
      'ai.workspace.creationFailed',
      'ai.workspace.creationNotAttempted',
    ])
    // Re-evaluate the same receipt as it is reconstructed after Undo.
    const undone = setupComponent(component, {
      ...message,
      undone: [0],
      items: [{ operationIndex: 0, id: 42 }],
    })
    expect(undone.rows.value[0].applied).toBe(false)
    expect(undone.rows.value[0].item).toBeUndefined()
    expect(undone.rows.value.map((row: any) => row.label)).toEqual([
      'ai.workspace.creationUndone',
      'ai.workspace.creationFailed',
      'ai.workspace.creationNotAttempted',
    ])
  }
  finally {
    vi.unstubAllGlobals()
  }
})
