import type { HttpAiSnapshot } from '../useHttpAi'
import type { AiHttpProposal } from '~/shared/aiHttp'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { emptyHttpRuntime } from '~/shared/httpRuntime'

Object.assign(globalThis, { onBeforeUnmount: vi.fn() })
async function setup() {
  vi.resetModules()
  const currentRequest = ref({
    id: 1,
    name: 'Order',
    protocol: 'http',
    runtimeState: 'ready',
    runtimeRevision: '1',
  })
  const currentDraft = ref({
    method: 'GET',
    url: '/orders/1',
    auth: { type: 'bearer', token: 'private' },
  })
  const draft = ref(emptyHttpRuntime())
  const lastResponse = ref<unknown>({ status: 200, body: '{"id":42}' })
  const activeEnvironmentId = ref(1)
  const busy = ref(false)
  let read!: () => HttpAiSnapshot | undefined
  let apply!: (
    s: HttpAiSnapshot,
    p: AiHttpProposal,
    check?: boolean,
  ) => boolean
  vi.doMock('@/electron', () => ({
    store: { preferences: { get: () => '/vault' } },
  }))
  vi.doMock('@/composables/spaces/http/useHttpRequests', () => ({
    useHttpRequests: () => ({
      currentRequest,
      currentDraft,
      isCurrentRequestLoading: ref(false),
    }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpRuntime', () => ({
    useHttpRuntime: () => ({ draft, busy }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpExecute', () => ({
    useHttpExecute: () => ({
      lastResponse,
      lastError: ref(null),
      lastExecutionRequest: ref(null),
      isExecuting: ref(false),
    }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpEnvironments', () => ({
    useHttpEnvironments: () => ({ activeEnvironmentId }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpApp', () => ({
    useHttpApp: () => ({ httpState: { requestId: 1, activePanel: 'request' } }),
  }))
  vi.doMock('../useAi', () => ({
    useAi: () => ({
      registerHttp: (r: typeof read, w: typeof apply) => {
        read = r
        apply = w
        return vi.fn()
      },
    }),
  }))
  const { useHttpAi } = await import('../useHttpAi')
  useHttpAi()
  const snapshot = read()!
  const proposal: AiHttpProposal = {
    context_id: snapshot.context.contextId,
    summary: 'Check ID',
    assertions: [
      { name: 'ID', source: 'json', path: '/id', operator: 'isNumber' },
    ],
  }
  return {
    read,
    apply,
    snapshot,
    proposal,
    draft,
    currentRequest,
    currentDraft,
    lastResponse,
    activeEnvironmentId,
    busy,
  }
}
beforeEach(() => vi.clearAllMocks())
describe('hTTP assertion draft application', () => {
  it('captures unsaved state, redacts auth and appends only after apply', async () => {
    const t = await setup()
    expect(t.snapshot.context.request).toContain('/orders/1')
    expect(t.snapshot.context.request).not.toContain('private')
    expect(t.apply(t.snapshot, t.proposal, true)).toBe(true)
    expect(t.draft.value.assertions).toEqual([])
    expect(t.apply(t.snapshot, t.proposal)).toBe(true)
    expect(t.draft.value.assertions).toEqual(t.proposal.assertions)
    expect(t.apply(t.snapshot, t.proposal)).toBe(false)
  })
  it.each([
    'request',
    'response',
    'environment',
    'runtime',
    'selection',
    'busy',
  ] as const)('rejects stale %s', async (change) => {
    const t = await setup()
    if (change === 'request')
      t.currentDraft.value.url = '/changed'
    if (change === 'response')
      t.lastResponse.value = { status: 500 }
    if (change === 'environment')
      t.activeEnvironmentId.value = 2
    if (change === 'runtime') {
      t.draft.value.assertions.push({
        name: 'Status',
        source: 'status',
        operator: 'eq',
        expected: 200,
      })
    }
    if (change === 'selection')
      t.currentRequest.value.id = 2
    if (change === 'busy')
      t.busy.value = true
    expect(t.apply(t.snapshot, t.proposal)).toBe(false)
  })
})

it.each([
  [false, 'The complete response body was captured.'],
  [true, 'The captured response body is incomplete.'],
  [undefined, 'Response body completeness was not recorded.'],
])(
  'explains body availability without copying runtime flags (%s)',
  async (truncated, expected) => {
    const t = await setup()
    t.lastResponse.value = {
      status: 200,
      body: '{"truncated":false}',
      truncated,
    }
    const result = JSON.parse(t.read()!.context.response!)
    expect(result).not.toHaveProperty('truncated')
    expect(result.body).toBe('{"truncated":false}')
    expect(result.note).toContain(expected)
  },
)
it('does not claim binary response text is available', async () => {
  const t = await setup()
  t.lastResponse.value = {
    status: 200,
    body: '',
    bodyKind: 'binary',
    truncated: false,
  }
  expect(JSON.parse(t.read()!.context.response!).note).toContain(
    'its text is not available',
  )
})
