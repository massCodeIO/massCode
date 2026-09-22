import type { WebContents } from 'electron'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiError } from '../errors'
import { registerAiHandlers } from '../ipc'

vi.mock('../workspaceTools', () => ({
  workspaceTools: ['create_workspace_items', 'propose_workspace_changes'].map(
    name => ({ type: 'function', function: { name } }),
  ),
  workspaceStructure: vi.fn(),
  workspaceRead: vi.fn(),
  workspaceInventory: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  create: vi.fn(),
  propose: vi.fn(),
  models: vi.fn(),
  configure: vi.fn(),
  plan: vi.fn(),
  turnPlan: vi.fn(async () => ({ scope: 'context' })),
  retrieve: vi.fn(),
}))
vi.mock('../workspace', () => ({
  createWorkspaceManager: () => ({
    clear: vi.fn(),
    apply: vi.fn(),
    undo: vi.fn(),
    create: mocks.create,
    propose: mocks.propose,
  }),
  workspaceTools: [],
  workspaceStructure: vi.fn(),
}))
vi.mock('../client', () => ({
  streamAiChat: mocks.stream,
  listAiModels: mocks.models,
}))
vi.mock('../vault', () => ({
  vaultIdentity: () => '/vault',
  vaultTools: [],
  vaultSearchSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
  retrieveVaultItems: mocks.retrieve,
  searchVault: vi.fn(async () => []),
  readVaultItem: vi.fn(ref => ({ ...ref, name: 'QA', content: 'fixture' })),
  executeVaultTool: vi.fn(async () => ({ items: [] })),
}))
vi.mock('../searchPlan', async importOriginal => ({
  ...(await importOriginal<typeof import('../searchPlan')>()),
  planVaultSearch: mocks.plan,
  planVaultTurn: mocks.turnPlan,
}))
vi.mock('../settings', () => ({
  configureAi: mocks.configure,
  rememberAiModels: vi.fn(),
  getAiSettings: () => ({ provider: 'ollama' }),
  getAiConnection: () => ({ baseURL: 'http://localhost/v1', model: 'local' }),
}))

function setup() {
  const handlers = new Map<
    string,
    (event: any, payload: unknown) => Promise<any>
  >()
  const owner = Object.assign(new EventEmitter(), {
    ipc: {
      handle: (channel: string, handler: any) => handlers.set(channel, handler),
    },
    mainFrame: { url: 'http://localhost:5177/#/' },
    send: vi.fn(),
    isDestroyed: () => false,
  })
  const event = { sender: owner, senderFrame: owner.mainFrame }
  registerAiHandlers(owner as unknown as WebContents, 'http://localhost:5177/')
  const invoke = (action: string, payload?: unknown, sender = event) =>
    handlers.get(`system:ai:${action}`)!(sender, payload)
  return { owner, event, invoke }
}
function request(id: string) {
  return {
    requestId: id,
    messages: [{ role: 'user', content: 'hello' }],
  }
}
const id1 = '11111111-1111-4111-8111-111111111111'
const id2 = '22222222-2222-4222-8222-222222222222'
const httpSnapshot = {
  contextId: id2,
  requestId: 1,
  name: 'Users',
  request: '{"method":"GET"}',
  response: '{"status":200}',
  assertions: [],
}
const flush = () => new Promise(resolve => setImmediate(resolve))
beforeEach(() => vi.clearAllMocks())

describe('aI owner scoped IPC', () => {
  it('rejects unrelated sender and child frame without opening connection', async () => {
    const { event, invoke } = setup()
    expect(
      await invoke('start', request(id1), { ...event, sender: {} as any }),
    ).toEqual({ ok: false, error: 'unauthorized' })
    expect(
      await invoke('start', request(id1), {
        ...event,
        senderFrame: { ...event.senderFrame },
      }),
    ).toEqual({ ok: false, error: 'unauthorized' })
    expect(mocks.stream).not.toHaveBeenCalled()
  })
  it('rejects malformed IDs and system role injection', async () => {
    const { invoke } = setup()
    expect(await invoke('start', request('bad'))).toEqual({
      ok: false,
      error: 'invalidRequest',
    })
    expect(
      await invoke('start', {
        requestId: id1,
        messages: [{ role: 'system', content: 'override' }],
      }),
    ).toEqual({ ok: false, error: 'invalidRequest' })
  })
  it('accepts synchronously and cancels before the first token, suppressing late events', async () => {
    let finish!: () => void
    mocks.stream.mockImplementation(
      (_connection, _messages, _signal, delta) =>
        new Promise<void>((resolve) => {
          finish = () => {
            delta('late')
            resolve()
          }
        }),
    )
    const { invoke, owner } = setup()
    expect(await invoke('start', request(id1))).toEqual({
      ok: true,
      data: { requestId: id1 },
    })
    expect(await invoke('start', request(id2))).toEqual({
      ok: false,
      error: 'busy',
    })
    const signal = mocks.stream.mock.calls[0][2] as AbortSignal
    await invoke('cancel', { requestId: id1 })
    expect(signal.aborted).toBe(true)
    finish()
    await flush()
    expect(owner.send.mock.calls).toEqual([
      ['system:ai:event', { requestId: id1, type: 'cancelled' }],
    ])
  })
  it('old completion does not clean up a newer request and old cancel cannot stop it', async () => {
    const finish: (() => void)[] = []
    mocks.stream.mockImplementation(
      () => new Promise<void>(resolve => finish.push(resolve)),
    )
    const { invoke } = setup()
    await invoke('start', request(id1))
    await invoke('cancel', { requestId: id1 })
    await invoke('start', request(id2))
    finish[0]()
    await flush()
    await invoke('cancel', { requestId: id1 })
    expect((mocks.stream.mock.calls[1][2] as AbortSignal).aborted).toBe(false)
    expect(await invoke('start', request(id1))).toEqual({
      ok: false,
      error: 'busy',
    })
    await invoke('cancel', { requestId: id2 })
    finish[1]()
  })
  it('navigation aborts active generation and sends only one terminal event', async () => {
    let finish!: () => void
    mocks.stream.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const { invoke, owner } = setup()
    await invoke('start', request(id1))
    owner.emit(
      'did-start-navigation',
      {},
      'http://localhost:5177/',
      false,
      true,
    )
    owner.emit('destroyed')
    expect((mocks.stream.mock.calls[0][2] as AbortSignal).aborted).toBe(true)
    finish()
    await flush()
    expect(owner.send).toHaveBeenCalledTimes(1)
  })
})

it('rejects orphaned tool results and unanswered tool calls', async () => {
  const { invoke } = setup()
  const last = { role: 'user', content: 'Continue' }
  for (const messages of [
    [{ role: 'tool', content: 'applied', tool_call_id: 'missing' }, last],
    [
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'c1',
            type: 'function',
            function: { name: 'propose_edit', arguments: '{}' },
          },
        ],
      },
      last,
    ],
  ]) {
    expect(await invoke('start', { requestId: id1, messages })).toEqual({
      ok: false,
      error: 'invalidRequest',
    })
  }
})

it('continues with a natural response after delivering a validated proposal', async () => {
  const calls = [
    {
      id: 'call_1',
      type: 'function',
      function: { name: 'propose_edit', arguments: '{}' },
    },
  ]
  mocks.stream.mockReset()
  mocks.stream
    .mockResolvedValueOnce(calls)
    .mockImplementationOnce(async (_connection, messages, _signal, delta) => {
      expect(messages.at(-1)).toMatchObject({
        role: 'tool',
        tool_call_id: 'call_1',
      })
      expect(JSON.parse(messages.at(-1).content).status).toBe(
        'awaiting_user_review',
      )
      delta('Explanation\n```js\ncode\n```\nExamples\n```js\nexample\n```')
      return []
    })
  const { invoke, owner } = setup()
  await invoke('start', request(id1))
  await flush()
  expect(owner.send.mock.calls.map(([, event]) => event.type)).toEqual([
    'tools',
    'protocol',
    'delta',
    'done',
  ])
})

it('keeps the proposal reviewable when its explanatory response fails', async () => {
  mocks.stream.mockReset()
  mocks.stream
    .mockResolvedValueOnce([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'propose_edit', arguments: '{}' },
      },
    ])
    .mockRejectedValueOnce(new Error('network'))
  const { invoke, owner } = setup()
  await invoke('start', request(id1))
  await flush()
  expect(owner.send.mock.calls.map(([, event]) => event.type)).toEqual([
    'tools',
    'protocol',
    'notice',
    'done',
  ])
})

it('plans only the first search and publishes storage results before the answer', async () => {
  mocks.plan.mockResolvedValue(['детали заказа', 'order details'])
  mocks.retrieve.mockResolvedValue({
    items: [{ type: 'http_request', id: 469, name: 'Order details' }],
    total: 1,
    queries: ['order details'],
  })
  mocks.stream.mockReset().mockImplementation(async (...args) => {
    const vault = args[10]
    await vault.execute(
      'search_vault',
      JSON.stringify({ query: 'http', type: 'http_request' }),
    )
    await vault.execute(
      'search_vault',
      JSON.stringify({ query: 'Create an order', type: 'http_request' }),
    )
    return []
  })
  const { invoke, owner } = setup()
  await invoke('start', { ...request(id1), vaultAccess: true })
  await flush()
  expect(mocks.plan).toHaveBeenCalledTimes(1)
  expect(mocks.retrieve.mock.calls).toEqual([
    ['http_request', ['детали заказа', 'order details']],
    ['http_request', ['Create an order']],
  ])
  expect(
    owner.send.mock.calls.filter(([, event]) => event.type === 'searchResults'),
  ).toHaveLength(2)
})

it('falls back to literal search when the plan is invalid without claiming expansion succeeded', async () => {
  mocks.plan.mockRejectedValue(new SyntaxError('invalid plan'))
  mocks.retrieve.mockResolvedValue({ items: [], total: 0, queries: ['order'] })
  mocks.stream.mockReset().mockImplementation(async (...args) => {
    await args[10].execute(
      'search_vault',
      JSON.stringify({ query: 'order', type: 'http_request' }),
    )
    return []
  })
  const { invoke, owner } = setup()
  await invoke('start', { ...request(id1), vaultAccess: true })
  await flush()
  expect(mocks.retrieve).toHaveBeenCalledWith('http_request', ['order'])
  expect(
    owner.send.mock.calls.find(
      ([, event]) => event.type === 'searchResults',
    )?.[1].result.expanded,
  ).toBe(false)
})

it('does not search or publish cards after cancellation during rewriting', async () => {
  let finish!: (value: string[]) => void
  mocks.plan.mockImplementation(
    () => new Promise(resolve => (finish = resolve)),
  )
  mocks.stream.mockReset().mockImplementation(async (...args) => {
    await args[10].execute(
      'search_vault',
      JSON.stringify({ query: 'order', type: 'http_request' }),
    )
    return []
  })
  const { invoke, owner } = setup()
  await invoke('start', { ...request(id1), vaultAccess: true })
  await flush()
  await invoke('cancel', { requestId: id1 })
  finish(['order'])
  await flush()
  expect(mocks.retrieve).not.toHaveBeenCalled()
  expect(
    owner.send.mock.calls.some(([, event]) => event.type === 'searchResults'),
  ).toBe(false)
})

it('starts with only the explicit attachment and searches on demand', async () => {
  mocks.stream.mockReset().mockResolvedValue([])
  const { invoke, owner } = setup()
  await invoke('start', {
    ...request(id1),
    vaultAccess: true,
    attachments: [{ type: 'http_request', id: 465 }],
  })
  await flush()
  const messages = mocks.stream.mock.calls[0][1]
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toContain('Attached saved records')
  expect(mocks.stream.mock.calls[0][10].remaining).toBe(6)
  expect(mocks.turnPlan).not.toHaveBeenCalled()
  expect(mocks.retrieve).not.toHaveBeenCalled()
  expect(
    owner.send.mock.calls.some(([, event]) => event.type === 'searchResults'),
  ).toBe(false)
})

it('does not answer or retrieve after cancellation during scope planning', async () => {
  let finish!: (value: any) => void
  mocks.turnPlan.mockImplementationOnce(
    () => new Promise(resolve => (finish = resolve)),
  )
  mocks.stream.mockReset()
  const { invoke, owner } = setup()
  await invoke('start', {
    ...request(id1),
    vaultAccess: true,
    httpContext: httpSnapshot,
  })
  await flush()
  await invoke('cancel', { requestId: id1 })
  finish({ scope: 'vault', type: 'http_request', queries: ['recent orders'] })
  await flush()
  expect(mocks.retrieve).not.toHaveBeenCalled()
  expect(mocks.stream).not.toHaveBeenCalled()
  expect(
    owner.send.mock.calls.some(([, event]) => event.type === 'searchResults'),
  ).toBe(false)
})

it('reads actual HTTP state only on demand and prevents unsolicited proposals', async () => {
  mocks.stream.mockResolvedValue(undefined)
  mocks.turnPlan.mockResolvedValueOnce({ scope: 'context' })
  const { invoke } = setup()
  await invoke('start', {
    ...request(id1),
    httpContext: {
      contextId: id2,
      requestId: 1,
      name: 'Order details',
      request: '{"method":"GET"}',
      response: '{"status":200,"body":{"status":"paid"}}',
      assertions: [
        { name: 'HTTP 200', source: 'status', operator: 'eq', expected: 200 },
      ],
    },
  })
  await flush()
  expect(mocks.stream).toHaveBeenCalledOnce()
  const messages = mocks.stream.mock.calls[0][1]
  expect(messages[0].content).toBe('hello')
  expect(messages).toHaveLength(1)
  const runtime = mocks.stream.mock.calls[0][10]
  const response = await runtime.execute(
    'read_http_context',
    '{"part":"response"}',
  )
  expect(response.content).toContain('paid')
  expect(response.configuredChecks[0].name).toBe('HTTP 200')
  expect(runtime.tools.map((tool: any) => tool.function.name)).toEqual([
    'read_http_context',
  ])
  expect(await runtime.execute('propose_http_assertions', '{}')).toEqual({
    error: 'ACTION_NOT_REQUESTED',
  })
})

it('continues the normal tool loop after malformed non-HTTP planning', async () => {
  mocks.stream.mockReset().mockResolvedValue([])
  const { invoke } = setup()
  await invoke('start', { ...request(id1), vaultAccess: true })
  await flush()
  expect(mocks.stream).toHaveBeenCalledOnce()
  expect(mocks.retrieve).not.toHaveBeenCalled()
})

it('retries malformed HTTP planning once, then restricts HTTP checks without blocking independent workspace tasks', async () => {
  mocks.stream.mockReset().mockResolvedValue([])
  mocks.turnPlan
    .mockRejectedValueOnce(new SyntaxError('bad JSON'))
    .mockRejectedValueOnce(new AiError('invalidResponse'))
  const { invoke } = setup()
  await invoke('start', {
    ...request(id1),
    vaultAccess: true,
    httpContext: httpSnapshot,
  })
  await flush()
  expect(mocks.turnPlan).toHaveBeenCalledTimes(2)
  const runtime = mocks.stream.mock.calls[0][10]
  expect(runtime.tools.map((tool: any) => tool.function.name)).not.toContain(
    'propose_http_assertions',
  )
  expect(runtime.instructions).toContain(
    'HTTP assertion preparation is unavailable',
  )
  expect(runtime.tools.map((tool: any) => tool.function.name)).toContain(
    'create_workspace_items',
  )
  expect((mocks.turnPlan.mock.calls as unknown[][])[1]?.[4]).toBe(true)
  expect(await runtime.execute('propose_http_assertions', '{}')).toEqual({
    error: 'ACTION_NOT_REQUESTED',
  })
})
it('uses a valid format retry to permit the requested HTTP checks', async () => {
  mocks.stream.mockReset().mockResolvedValue([])
  mocks.turnPlan
    .mockRejectedValueOnce(new SyntaxError('bad JSON'))
    .mockResolvedValueOnce({
      scope: 'context',
      httpAction: 'assertions',
    } as any)
  const { invoke } = setup()
  await invoke('start', { ...request(id1), httpContext: httpSnapshot })
  await flush()
  const runtime = mocks.stream.mock.calls[0][10]
  expect(runtime.tools.map((tool: any) => tool.function.name)).toContain(
    'propose_http_assertions',
  )
  expect(runtime.instructions).toBeUndefined()
})
it.each([
  'authentication',
  'connection',
  'timeout',
  'rateLimit',
  'upstream',
] as const)('does not recover a %s planning failure', async (code) => {
  mocks.stream.mockReset().mockResolvedValue([])
  mocks.turnPlan.mockRejectedValueOnce(new AiError(code))
  const { invoke, owner } = setup()
  await invoke('start', { ...request(id1), httpContext: httpSnapshot })
  await flush()
  expect(mocks.turnPlan).toHaveBeenCalledOnce()
  expect(mocks.stream).not.toHaveBeenCalled()
  expect(
    owner.send.mock.calls.some(
      ([, event]) => event.type === 'error' && event.error === code,
    ),
  ).toBe(true)
})

it('continues collection creation with a returned folder ID, deduplicates repeats and still stops for review', async () => {
  mocks.create.mockImplementation((plan) => {
    const folder = plan.operations[0].kind === 'folder'
    return {
      proposal: {
        id: folder ? 'collection' : 'request',
        summary: plan.summary,
        changes: [],
      },
      applied: [0],
      items: folder
        ? []
        : [{ id: 99, name: 'Users', type: 'http_request', operationIndex: 0 }],
      containers: folder
        ? [
            {
              id: 75,
              name: 'API',
              kind: 'collection',
              space: 'http',
              operationIndex: 0,
            },
          ]
        : [],
    }
  })
  mocks.propose.mockReturnValue({
    id: 'review',
    summary: 'Rename',
    changes: [],
  })
  mocks.stream.mockReset().mockImplementation(async (...args) => {
    const runtime = args[10]
    const first = await runtime.execute(
      'create_workspace_items',
      JSON.stringify({
        summary: 'Collection',
        items: [{ type: 'http_collection', name: 'API' }],
      }),
    )
    expect(runtime.isComplete()).toBe(false)
    expect(first.containers[0].id).toBe(75)
    const second = await runtime.execute(
      'create_workspace_items',
      JSON.stringify({
        summary: 'Request',
        items: [
          {
            type: 'http_request',
            name: 'Users',
            method: 'GET',
            url: 'https://example.test/users',
            folderId: first.containers[0].id,
          },
        ],
      }),
    )
    const duplicate = await runtime.execute(
      'create_workspace_items',
      JSON.stringify({
        items: [
          {
            folderId: 75,
            url: 'https://example.test/users',
            method: 'GET',
            name: 'Users',
            type: 'http_request',
          },
        ],
        summary: 'Different narration',
      }),
    )
    expect(duplicate).toEqual(second)
    expect(runtime.isComplete()).toBe(false)
    await runtime.execute(
      'propose_workspace_changes',
      JSON.stringify({
        summary: 'Rename',
        operations: [
          {
            space: 'http',
            kind: 'item',
            action: 'update',
            id: 99,
            fields: { name: 'Users renamed' },
          },
        ],
      }),
    )
    expect(runtime.isComplete()).toBe(true)
    expect(await runtime.execute('create_workspace_items', '{}')).toMatchObject(
      { error: 'PROPOSAL_ALREADY_PENDING' },
    )
    return []
  })
  const { invoke, owner } = setup()
  await invoke('start', { ...request(id1), vaultAccess: true })
  await flush()
  expect(mocks.create).toHaveBeenCalledTimes(2)
  expect(mocks.create.mock.calls[1][0].operations[0].fields.folderId).toBe(75)
  expect(
    owner.send.mock.calls.filter(
      ([, event]) => event?.type === 'workspaceProposal',
    ),
  ).toHaveLength(3)
})

it('limits planned creation operations across calls, including a partial batch', async () => {
  mocks.create.mockImplementation(plan => ({
    proposal: {
      id: 'partial',
      summary: plan.summary,
      changes: plan.operations.map((operation: any) => ({
        name: operation.fields.name,
        operation,
        before: '{}',
        after: '{}',
      })),
    },
    applied: [0],
    items: [],
    containers: [],
    failed: 1,
  }))
  mocks.stream.mockReset().mockImplementation(async (...args) => {
    const runtime = args[10]
    const first = await runtime.execute(
      'create_workspace_items',
      JSON.stringify({
        summary: 'Batch',
        items: Array.from({ length: 30 }, (_, i) => ({
          type: 'note',
          name: `Note ${i}`,
          content: '',
        })),
      }),
    )
    expect(first.status).toBe('partially_created')
    expect(
      await runtime.execute(
        'create_workspace_items',
        JSON.stringify({
          summary: 'Extra',
          items: [{ type: 'note', name: 'Extra', content: '' }],
        }),
      ),
    ).toMatchObject({ error: 'TURN_OPERATION_LIMIT' })
    return []
  })
  const { invoke } = setup()
  await invoke('start', { ...request(id1), vaultAccess: true })
  await flush()
  expect(mocks.create).toHaveBeenCalledOnce()
  await expect(mocks.stream.mock.results[0].value).resolves.toEqual([])
})
