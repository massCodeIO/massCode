import type { HttpAiSnapshot } from '../useHttpAi'
import type { AiHttpProposal } from '~/shared/aiHttp'
import type { AiHttpAction } from '~/shared/aiHttpActions'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, watch } from 'vue'
import { emptyHttpRuntime } from '~/shared/httpRuntime'
import { applyQueryToUrl, applyUrlToQuery } from '~/shared/httpUrlQuery'

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
    headers: [],
    query: [],
    formData: [],
    bodyType: 'none',
    body: null,
    auth: { type: 'bearer', token: 'private' },
  })
  const draft = ref(emptyHttpRuntime())
  const lastResponse = ref<unknown>({ status: 200, body: '{"id":42}' })
  const activeEnvironmentId = ref(1)
  const busy = ref(false)
  const saveRequest = vi.fn(async () => false)
  const discardRequestChanges = vi.fn(() => true)
  let action!: (
    snapshot: HttpAiSnapshot,
    intent: AiHttpAction,
    execute: () => Promise<any>,
  ) => Promise<boolean>
  let read!: () => HttpAiSnapshot | undefined
  let apply!: (
    s: HttpAiSnapshot,
    p: AiHttpProposal,
    check?: boolean,
  ) => boolean
  vi.doMock('@/composables/spaces/http/useHttpSettings', () => ({
    useHttpSettings: () => ({
      settings: { transport: {}, skipCertificateVerification: false },
    }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpWebSocket', () => ({
    useHttpWebSocket: () => ({ captureAdoption: vi.fn() }),
  }))
  vi.doMock('@/electron', () => ({
    store: { preferences: { get: () => '/vault' } },
  }))
  vi.doMock('@/composables/spaces/http/useHttpRequests', () => ({
    useHttpRequests: () => ({
      currentRequest,
      selectedRequestIds: ref([1]),
      currentDraft,
      isCurrentRequestLoading: ref(false),
    }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpRuntime', () => ({
    useHttpRuntime: () => ({ draft, busy, saveRequest, discardRequestChanges }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpExecute', () => ({
    useHttpExecute: () => ({
      lastResponse,
      executeCurrentRequest: (execute: () => Promise<any>) => execute(),
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
      registerWorkspace: () => vi.fn(),
      registerHttp: (r: typeof read, w: typeof apply, a: typeof action) => {
        action = a
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
    action,
    saveRequest,
    discardRequestChanges,
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

it('patches the draft without touching omitted auth or saving, and reports a real save failure', async () => {
  const t = await setup()
  expect(
    await t.action(
      t.snapshot,
      { action: 'patchDraft', summary: 'URL', fields: { url: '/new' } },
      vi.fn(),
    ),
  ).toBe(true)
  expect(t.currentDraft.value.url).toBe('/new')
  expect(t.currentDraft.value.auth.token).toBe('private')
  expect(t.saveRequest).not.toHaveBeenCalled()
  expect(
    await t.action(
      t.read()!,
      { action: 'saveDraft', summary: 'Save' },
      vi.fn(),
    ),
  ).toBe(false)
  expect(t.saveRequest).toHaveBeenCalledOnce()
  expect(
    await t.action(
      t.read()!,
      { action: 'discardDraft', summary: 'Discard' },
      vi.fn(),
    ),
  ).toBe(true)
  expect(t.discardRequestChanges).toHaveBeenCalledOnce()
})
it('rejects changed draft before send and keeps raw request separate from provider context', async () => {
  const t = await setup()
  expect(t.snapshot.privateDraft?.request.auth.token).toBe('private')
  expect(JSON.stringify(t.snapshot.context)).not.toContain('private')
  expect(t.snapshot.privateDraft).not.toHaveProperty('baseline')
  const execute = vi.fn(async () => ({ status: 200 }))
  t.currentDraft.value.url = '/changed'
  expect(
    await t.action(
      t.snapshot,
      { action: 'send', source: 'draft', requestId: 1, summary: 'Send' },
      execute,
    ),
  ).toBe(false)
  expect(execute).not.toHaveBeenCalled()
  expect(
    await t.action(
      t.read()!,
      { action: 'send', source: 'draft', requestId: 1, summary: 'Send' },
      execute,
    ),
  ).toBe(true)
  expect(execute).toHaveBeenCalledOnce()
})
it('retains analysis for invalid private drafts and accepts large body without copying response into private payload', async () => {
  const t = await setup()
  Object.assign(t.currentDraft.value, {
    bodyType: 'text',
    body: 'x'.repeat(250000),
  })
  t.lastResponse.value = { body: 'y'.repeat(2100000) }
  const snapshot = t.read()!
  expect(snapshot.privateDraft?.request.body?.length).toBe(250000)
  expect(JSON.stringify(snapshot.privateDraft)).not.toContain('yyyyy')
  Object.assign(t.currentDraft.value, { method: 'invalid' })
  expect(t.read()!.privateDraft).toBeUndefined()
  expect(t.read()!.context.request).toBeTruthy()
})

it('applies compound changes privately and reports save failure before any send', async () => {
  const t = await setup()
  const execute = vi.fn()
  expect(
    await t.action(
      t.snapshot,
      {
        action: 'patchAndSend',
        summary: 'Change and send',
        fields: { url: '/compound' },
      },
      execute,
    ),
  ).toBe(true)
  expect(t.currentDraft.value.url).toBe('/compound')
  expect(t.currentDraft.value.auth.token).toBe('private')
  expect(t.saveRequest).not.toHaveBeenCalled()
  expect(execute).not.toHaveBeenCalled()
  expect(
    await t.action(
      t.read()!,
      {
        action: 'saveAndSend',
        summary: 'Save and send',
        fields: { url: '/save' },
      },
      execute,
    ),
  ).toBe(false)
  expect(t.saveRequest).toHaveBeenCalledOnce()
  expect(execute).not.toHaveBeenCalled()
})

it.each(['patchAndSend', 'saveAndSend'] as const)(
  'keeps %s URL and query in sync with synchronous editor watchers',
  async (action) => {
    const t = await setup()
    let syncing = false
    const stopUrl = watch(
      () => t.currentDraft.value.url,
      (url) => {
        if (syncing)
          return
        syncing = true
        t.currentDraft.value.query = applyUrlToQuery(
          url,
          t.currentDraft.value.query,
        )
        syncing = false
      },
      { flush: 'sync' },
    )
    const stopQuery = watch(
      () => t.currentDraft.value.query,
      (query) => {
        if (syncing)
          return
        syncing = true
        t.currentDraft.value.url = applyQueryToUrl(
          t.currentDraft.value.url,
          query,
        )
        syncing = false
      },
      { flush: 'sync', deep: true },
    )
    t.saveRequest.mockResolvedValue(true)
    try {
      for (const fields of [
        { url: '/orders/1?page=2' },
        {
          query: [
            { key: 'page', value: '3', description: 'Page', enabled: true },
          ],
        },
      ]) {
        expect(
          await t.action(
            t.read()!,
            { action, summary: 'Change and send', fields },
            vi.fn(),
          ),
        ).toBe(true)
        expect(t.currentDraft.value.url).toBe(fields.url ?? '/orders/1?page=3')
        expect(t.currentDraft.value.query[0]).toMatchObject({
          key: 'page',
          value: fields.url ? '2' : '3',
        })
      }
    }
    finally {
      stopUrl()
      stopQuery()
    }
  },
)

it.each(['patchAndSend', 'saveAndSend'] as const)(
  'keeps %s runtime-only encoding changes and inherited reset synchronized',
  async (action) => {
    const t = await setup()
    t.currentDraft.value.query = [
      { key: 'q', value: 'a b', description: '', enabled: true },
    ] as any
    t.currentDraft.value.url = '/orders/1?q=a%20b'
    t.draft.value = {
      ...emptyHttpRuntime(),
      version: 2,
      transport: { encodeUrl: true },
    }
    t.saveRequest.mockResolvedValue(true)
    const stop = watch(
      () => t.draft.value.transport?.encodeUrl ?? true,
      (encodeUrl) => {
        t.currentDraft.value.url = applyQueryToUrl(
          t.currentDraft.value.url,
          t.currentDraft.value.query,
          encodeUrl,
        )
      },
      { flush: 'sync' },
    )
    try {
      for (const reset of [false, true]) {
        const runtime = {
          ...emptyHttpRuntime(),
          version: 2 as const,
          ...(reset ? {} : { transport: { encodeUrl: false } }),
        }
        expect(
          await t.action(
            t.read()!,
            { action, fields: { runtime }, summary: 'Change encoding' },
            vi.fn(),
          ),
        ).toBe(true)
        expect(t.currentDraft.value.url).toBe(
          reset ? '/orders/1?q=a%20b' : '/orders/1?q=a b',
        )
        expect(t.currentDraft.value.query[0]).toMatchObject({
          key: 'q',
          value: 'a b',
        })
      }
    }
    finally {
      stop()
    }
  },
)
