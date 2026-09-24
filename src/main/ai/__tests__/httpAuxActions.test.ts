import { EventEmitter } from 'node:events'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyHttpRuntime } from '../../../shared/httpRuntime'
import { HttpCookieJar } from '../../http/cookies/jar'
import { httpConsole } from '../../http/devtools/console'
import { createHttpActionManager } from '../httpActions'
import { readHttpAuxState } from '../httpAuxActions'

const state = vi.hoisted(() => ({
  jar: null as any,
  vault: '/vault',
  env: 1,
  requests: [] as any[],
  trusted: false,
  run: null as any,
  ws: null as any,
  start: vi.fn(),
  connect: vi.fn(),
  send: vi.fn(),
  wait: vi.fn(async () => {}),
  disconnect: vi.fn(),
  dispose: vi.fn(),
  getHistorySnapshot: vi.fn(),
}))
vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: () => ({
        transport: { timeoutMs: 77 },
        skipCertificateVerification: false,
      }),
    },
  },
}))
vi.mock('../vault', () => ({ vaultIdentity: () => state.vault }))
vi.mock('../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => state.vault,
}))
vi.mock('../../http/runtime/ownedExecution', () => ({
  executeOwnedHttpRequest: vi.fn(),
}))
vi.mock('../../http/cookies/store', () => ({
  getHttpCookieJar: () => state.jar,
}))
vi.mock('../../storage', () => ({
  useHttpStorage: () => ({
    requests: {
      getRequestById: (id: number) =>
        state.requests.find(item => item.id === id),
    },
    folders: { getFolders: () => [{ id: 10, name: 'Collection' }] },
    environments: {
      getActiveEnvironmentId: () => state.env,
      getEnvironments: () => [{ id: 1, variables: {} }],
    },
    history: { getEntries: () => [], getSnapshot: state.getHistorySnapshot },
  }),
}))
vi.mock('../../http/scripts/trust', () => ({
  scriptsTrusted: () => state.trusted,
  setScriptTrust: (_id: number, _scripts: unknown, allowed: boolean) => {
    state.trusted = allowed
  },
}))
vi.mock('../../http/runtime/runner', () => ({
  prepareHttpRunSnapshot: () => ({
    requests: new Map(
      state.requests.map(record => [
        record.id,
        {
          requestId: record.id,
          environmentId: state.env,
          request: record,
          runtime: record.runtime,
        },
      ]),
    ),
    view: {
      runId: 'run',
      folderId: 1,
      folderName: 'Collection',
      environmentName: 'Env',
      state: 'ready',
      steps: state.requests.map(item => ({
        requestId: item.id,
        name: item.name,
        method: 'GET',
        state: 'pending',
      })),
    },
  }),
  registerHttpRun: (_owner: number, prepared: any) => {
    state.run = prepared.view
  },
  getHttpRun: (owner: number, id: string) => {
    if (owner !== 1 || id !== state.run.runId)
      throw new Error('HTTP_RUN_NOT_FOUND')
    return structuredClone(state.run)
  },
  startHttpRun: state.start,
  cancelHttpRun: () => {
    state.run.state = 'cancelled'
  },
  disposeHttpRun: state.dispose,
}))
vi.mock('../../http/websocket/session', () => ({
  connectWebSocket: state.connect,
  waitForWebSocket: state.wait,
  sendWebSocket: state.send,
  disconnectWebSocket: state.disconnect,
  disposeWebSocket: state.dispose,
  clearWebSocket: () => {
    state.ws.messages = []
  },
  readWebSocket: (owner: number, id: string) => {
    if (owner !== 1 || state.ws?.connectionId !== id)
      throw new Error('WS_UNAVAILABLE')
    return structuredClone(state.ws)
  },
  readWebSocketForAi: (owner: number, id: string) => {
    if (owner !== 1 || state.ws?.connectionId !== id)
      throw new Error('WS_UNAVAILABLE')
    return structuredClone(state.ws)
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  state.vault = '/vault'
  state.env = 1
  state.trusted = false
  state.ws = null
  state.jar = new HttpCookieJar()
  state.requests = [1, 2].map(id => ({
    id,
    createdAt: id,
    name: `Request ${id}`,
    protocol: 'http',
    runtimeState: 'ready',
    runtime: emptyHttpRuntime(),
    url: 'https://example.test',
    method: 'GET',
    auth: { type: 'none' },
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
    formData: [],
  }))
  state.start.mockImplementation(async (_owner, options) => ({
    ...state.run,
    state: 'passed',
    steps: options.requestIds.map((id: number) => ({
      requestId: id,
      state: 'passed',
    })),
  }))
  state.connect.mockImplementation(
    (_owner, input) =>
      (state.ws = {
        connectionId: input.connectionId,
        state: 'open',
        messages: [],
        dropped: 0,
        lastId: 0,
      }),
  )
  state.disconnect.mockImplementation(() => {
    state.ws.state = 'closed'
  })
})
function manager() {
  return createHttpActionManager(
    Object.assign(new EventEmitter(), { id: 1 }) as any,
  )
}
it('freezes runner order and actual options, does not start before Apply, and checks changed sources', async () => {
  const m = manager()
  const proposal = m.propose({
    action: 'runCollection',
    summary: 'Run',
    folderId: 10,
    requestIds: [2, 1],
    continueOnFailure: true,
  })
  expect(state.start).not.toHaveBeenCalled()
  expect((await m.apply(proposal.id)).view.state).toBe('done')
  expect(state.start).toHaveBeenCalledWith(
    1,
    expect.objectContaining({
      requestIds: [2, 1],
      continueOnFailure: true,
      transport: { timeoutMs: 77 },
    }),
  )
  expect((await m.apply(proposal.id)).view.state).toBe('done')
  expect(state.start).toHaveBeenCalledTimes(1)
  const stale = m.propose({
    action: 'runCollection',
    summary: 'Run',
    folderId: 10,
  })
  state.requests[0].runtime = { ...emptyHttpRuntime(), version: 2 }
  await expect(m.apply(stale.id)).rejects.toThrow('ACTION_STALE')
})
it('keeps ordinary-name cookie values private and preserves them during metadata edits', async () => {
  state.jar.save('example.test', 'ordinary=private-cookie; Path=/; Secure')
  const cookie = state.jar.read(null).cookies[0]
  const m = manager()
  const proposal = m.propose({
    action: 'cookieMetadata',
    summary: 'Settings',
    id: cookie.id,
    fields: { httpOnly: true },
  })
  expect(JSON.stringify(proposal)).not.toContain('private-cookie')
  expect(proposal.cookie).toEqual({
    name: 'ordinary',
    changes: [{ field: 'httpOnly', before: false, after: true }],
  })
  expect((await m.apply(proposal.id)).view.state).toBe('done')
  expect(state.jar.read(null).cookies[0]).toMatchObject({
    value: 'private-cookie',
    httpOnly: true,
  })
  const result = readHttpAuxState(1, { kind: 'cookies' })
  expect(JSON.stringify(result)).not.toContain('private-cookie')
  expect(JSON.stringify(result)).not.toContain('raw')
  const stale = m.propose({
    action: 'cookieDelete',
    summary: 'Delete',
    id: cookie.id,
  })
  state.jar.save('example.test', 'ordinary=changed; Path=/')
  await expect(m.apply(stale.id)).rejects.toThrow('ACTION_STALE')
})
it('connects/sends only reviewed WebSocket actions, scopes controls to owner, and disconnects actual service', async () => {
  state.requests[0].protocol = 'websocket'
  state.requests[0].url = 'wss://example.test'
  const m = manager()
  const proposal = m.propose({
    action: 'connectWebSocket',
    source: 'saved',
    requestId: 1,
    summary: 'Connect',
  })
  expect(state.connect).not.toHaveBeenCalled()
  const pendingId = JSON.parse((proposal.preview as any).content).connectionId
  expect(pendingId).toBeTypeOf('string')
  expect(() => m.control(pendingId, 'disconnect')).toThrow(
    'ACTION_UNAVAILABLE',
  )
  const applied = await m.apply(proposal.id)
  expect(applied.view.state).toBe('running')
  expect((await m.complete(proposal.id, true)).view.state).toBe('done')
  expect(applied.webSocket).toEqual({
    connectionId: state.ws.connectionId,
    requestId: 1,
    environmentId: 1,
  })
  expect(applied.view).not.toHaveProperty('webSocket')
  const id = state.ws.connectionId
  const send = m.propose({
    action: 'sendWebSocket',
    connectionId: id,
    text: 'hello',
    summary: 'Send',
  })
  expect(state.send).not.toHaveBeenCalled()
  await m.apply(send.id)
  expect(state.send).toHaveBeenCalledWith(1, id, 'hello')
  expect(() =>
    readHttpAuxState(2, { kind: 'websocket', activityId: id }),
  ).toThrow('WS_UNAVAILABLE')
  expect(() => manager().control(id, 'disconnect')).toThrow(
    'ACTION_UNAVAILABLE',
  )
  expect(m.control(id, 'status').id).toBe(proposal.id)
  state.vault = '/other'
  expect(() => m.control(id, 'disconnect')).toThrow('ACTION_STALE')
  expect(state.disconnect).not.toHaveBeenCalled()
  state.vault = '/vault'
  expect(m.control(id, 'disconnect').id).toBe(proposal.id)
  expect(state.ws.state).toBe('closed')
})
it('does not grant script trust until its exact reviewed script is applied', async () => {
  state.requests[0].runtime = {
    ...emptyHttpRuntime(),
    version: 2,
    scripts: { preRequest: 'console.log(1)', postResponse: '' },
  }
  const m = manager()
  const proposal = m.propose({
    action: 'scriptTrust',
    subject: 'request',
    id: 1,
    allowed: true,
    summary: 'Trust',
  })
  expect(state.trusted).toBe(false)
  state.requests[0].runtime.scripts.preRequest = 'console.log(2)'
  await expect(m.apply(proposal.id)).rejects.toThrow('ACTION_STALE')
  const fresh = m.propose({
    action: 'scriptTrust',
    subject: 'request',
    id: 1,
    allowed: true,
    summary: 'Trust',
  })
  await m.apply(fresh.id)
  expect(state.trusted).toBe(true)
})

it('clearing AI state with no owned activity does not dispose a manual WebSocket or runner', () => {
  state.ws = {
    connectionId: 'manual',
    state: 'open',
    messages: [],
    dropped: 0,
    lastId: 0,
  }
  manager().clear()
  expect(state.dispose).not.toHaveBeenCalled()
  expect(state.ws.state).toBe('open')
})

it('cannot disconnect a manual connection through a cancelled unapproved proposal', () => {
  state.ws = {
    connectionId: '11111111-1111-4111-8111-111111111111',
    state: 'open',
    messages: [],
    dropped: 0,
    lastId: 0,
  }
  const m = manager()
  const proposal = m.propose({
    action: 'sendWebSocket',
    connectionId: '11111111-1111-4111-8111-111111111111',
    text: 'hello',
    summary: 'Send',
  })
  expect(() => m.control(state.ws.connectionId, 'disconnect')).toThrow(
    'ACTION_UNAVAILABLE',
  )
  m.control(proposal.id, 'cancel')
  m.control(proposal.id, 'disconnect')
  expect(state.ws.state).toBe('open')
})

it.each(['open', 'error'])(
  'returns a private adoption receipt only for a successful %s connect',
  async (connectionState) => {
    state.requests[0].protocol = 'websocket'
    state.requests[0].url = 'wss://example.test'
    state.connect.mockImplementation(
      (_owner, input) =>
        (state.ws = {
          connectionId: input.connectionId,
          state: connectionState,
          messages: [],
          lastId: 0,
          dropped: 0,
        }),
    )
    const m = manager()
    const proposal = m.propose({
      action: 'connectWebSocket',
      source: 'saved',
      requestId: 1,
      summary: 'Connect',
    })
    const result = await m.apply(proposal.id)
    expect(result.view.state).toBe(
      connectionState === 'open' ? 'running' : 'failed',
    )
    expect(Boolean(result.webSocket)).toBe(connectionState === 'open')
  },
)

it('does not authorize a runtime connection ID through an approved send action', async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  state.ws = {
    connectionId: id,
    state: 'open',
    messages: [],
    dropped: 0,
    lastId: 0,
  }
  const m = manager()
  const proposal = m.propose({
    action: 'sendWebSocket',
    connectionId: id,
    text: 'hello',
    summary: 'Send',
  })
  await m.apply(proposal.id)
  expect(() => m.control(id, 'disconnect')).toThrow('ACTION_UNAVAILABLE')
  expect(state.disconnect).not.toHaveBeenCalled()
})

it('publishes the registered run before waiting and returns failed assertions as a completed result', async () => {
  let finish!: (value: unknown) => void
  state.start.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const onRun = vi.fn()
  const m = createHttpActionManager(
    Object.assign(new EventEmitter(), { id: 1 }) as any,
    onRun,
  )
  const proposal = m.propose({
    action: 'runCollection',
    summary: 'Run',
    folderId: 10,
  })
  const first = m.apply(proposal.id)
  const duplicate = m.apply(proposal.id)
  expect(onRun).toHaveBeenCalledWith(proposal.id, 'run')
  expect(state.start).toHaveBeenCalledTimes(1)
  finish({
    runId: 'run',
    state: 'failed',
    steps: [{ assertions: [{ passed: false }] }],
  })
  expect((await first).view.state).toBe('done')
  expect((await first).view.run?.view).toMatchObject({
    runId: 'run',
    state: 'failed',
    steps: [{ assertions: [{ passed: false }] }],
  })
  expect(await duplicate).toEqual(await first)
})

it('waits for the socket to open before returning a completion receipt', async () => {
  const m = manager()
  state.requests[0].protocol = 'websocket'
  state.requests[0].url = 'ws://example.test'
  let finish!: () => void
  state.wait.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  state.connect.mockImplementationOnce(
    (_owner, input) =>
      (state.ws = {
        connectionId: input.connectionId,
        state: 'connecting',
        messages: [],
        lastId: 0,
        dropped: 0,
      }),
  )
  const proposal = m.propose({
    action: 'connectWebSocket',
    source: 'saved',
    requestId: 1,
    summary: 'Connect',
  })
  let completed = false
  const pending = m.apply(proposal.id).then((result) => {
    completed = true
    return result
  })
  await Promise.resolve()
  expect(completed).toBe(false)
  state.ws.state = 'open'
  finish()
  expect((await pending).view.state).toBe('running')
  expect((await m.complete(proposal.id, true)).view.state).toBe('done')
})

it('shows deterministic global/per-request cookie switches in the primary preview', () => {
  const m = manager()
  expect(
    m.propose({
      action: 'cookiesEnabled',
      summary: 'Cookies',
      requestId: null,
      enabled: true,
    }).cookie,
  ).toEqual({ requestId: null, enabled: true })
  expect(
    m.propose({
      action: 'cookiesEnabled',
      summary: 'Cookies',
      requestId: 1,
      enabled: false,
    }).cookie,
  ).toEqual({ requestId: 1, enabled: false })
})
it('previews actual WebSocket transport without unsupported HTTP runtime overrides', () => {
  state.requests[0].protocol = 'websocket'
  state.requests[0].url = 'wss://example.test'
  const request = { ...state.requests[0] }
  const runtime = {
    ...emptyHttpRuntime(),
    transport: { skipCertificateVerification: false, timeoutMs: 9000 },
    scripts: { preRequest: 'must not run', postResponse: '' },
  }
  const proposal = manager().propose(
    {
      action: 'connectWebSocket',
      source: 'draft',
      requestId: 1,
      summary: 'Connect',
    },
    {
      contextId: '11111111-1111-4111-8111-111111111111',
      protocol: 'websocket',
      requestId: 1,
      environmentId: 1,
      request,
      runtime,
      transport: { timeoutMs: 7000 },
      skipCertificateVerification: true,
    },
  )
  expect(proposal.request).toMatchObject({
    scripts: [],
    transport: {
      skipCertificateVerification: true,
      timeoutMs: 15000,
      followRedirects: false,
    },
  })
  expect(state.connect).not.toHaveBeenCalled()
})

it('distinguishes historical execution input from unavailable captured outgoing headers', () => {
  state.getHistorySnapshot.mockReturnValueOnce({
    request: {
      method: 'GET',
      url: 'https://example.test/products',
      headers: [],
      body: '',
      truncated: false,
    },
    response: {
      status: 200,
      headers: [{ key: 'Set-Cookie', value: 'session=private' }],
      body: 'ok',
      bodyKind: 'text',
      truncated: false,
    },
  })

  const result = readHttpAuxState(1, { kind: 'history', id: 123 }) as {
    content: string
  }
  const snapshot = JSON.parse(result.content)
  expect(state.getHistorySnapshot).toHaveBeenCalledWith(123)
  expect(snapshot).not.toHaveProperty('request')
  expect(snapshot.executionInput.headers).toEqual([])
  expect(snapshot.capturedRequest).toBeNull()
  expect(snapshot.evidence).toContain(
    'Missing headers here do not prove they were not sent',
  )
  expect(snapshot.response).toMatchObject({
    status: 200,
    headers: [{ key: 'Set-Cookie', value: '[REDACTED]' }],
    body: 'ok',
  })
})

it('preserves absent history snapshots and history list pagination', () => {
  state.getHistorySnapshot.mockReturnValueOnce(null)
  expect(readHttpAuxState(1, { kind: 'history', id: 404 })).toEqual({
    content: 'null',
    totalLength: 4,
    nextOffset: null,
  })
  expect(readHttpAuxState(1, { kind: 'history', limit: 1 })).toEqual({
    content: '[',
    totalLength: 2,
    nextOffset: 1,
  })
})

it('reads safe console capture only for the current vault with paging', () => {
  httpConsole.clear()
  const id = httpConsole.append({
    kind: 'network',
    level: 'log',
    executionId: 'safe-execution',
    message: 'raw secret',
    details: { requestBody: 'raw body' },
  })
  httpConsole.publishAiContent(
    id,
    { executionId: 'safe-execution', vaultPath: state.vault },
    {
      message: 'Captured outgoing HTTP attempt',
      details: {
        historyId: 123,
        requestHeaders: [{ key: 'Cookie', value: '[REDACTED]' }],
      },
    },
  )
  const full = readHttpAuxState(1, { kind: 'console' }) as { content: string }
  expect(JSON.parse(full.content).entries[0].details.historyId).toBe(123)
  expect(full.content).not.toMatch(/raw secret|raw body/)
  const first = readHttpAuxState(1, { kind: 'console', limit: 10 }) as {
    content: string
    nextOffset: number
  }
  const remaining = readHttpAuxState(1, {
    kind: 'console',
    offset: first.nextOffset,
  }) as { content: string }
  expect(first.content + remaining.content).toBe(full.content)
  state.vault = '/another-vault'
  expect(
    JSON.parse(
      (readHttpAuxState(1, { kind: 'console' }) as { content: string }).content,
    ).entries,
  ).toEqual([])
  httpConsole.clear()
})

it.each([false, true])(
  'waits for native adoption and cleans up an unavailable connection (ack=%s)',
  async (success) => {
    state.requests[0].protocol = 'websocket'
    state.requests[0].url = 'wss://example.test'
    const m = manager()
    const proposal = m.propose({
      action: 'connectWebSocket',
      source: 'saved',
      requestId: 1,
      summary: 'Connect',
    })
    const connecting = await m.apply(proposal.id)
    expect(connecting.view.state).toBe('running')
    if (success)
      state.ws.state = 'closed'
    const completed = await m.complete(proposal.id, success)
    expect(completed.view.state).toBe(success ? 'failed' : 'cancelled')
    expect(completed.view.result).toMatchObject({
      connectionAdopted: false,
      cleanup: 'disposed',
    })
    expect(state.dispose).toHaveBeenCalled()
    const count = state.dispose.mock.calls.length
    expect(await m.complete(proposal.id, success)).toEqual(completed)
    expect(state.dispose).toHaveBeenCalledTimes(count)
    expect(state.connect).toHaveBeenCalledOnce()
  },
)

it('rejects WebSocket adoption acknowledgement after a vault switch', async () => {
  state.requests[0].protocol = 'websocket'
  state.requests[0].url = 'wss://example.test'
  const m = manager()
  const proposal = m.propose({
    action: 'connectWebSocket',
    source: 'saved',
    requestId: 1,
    summary: 'Connect',
  })
  expect((await m.apply(proposal.id)).view.state).toBe('running')
  state.vault = '/other'
  await expect(m.complete(proposal.id, true)).rejects.toThrow('ACTION_STALE')
  expect(state.connect).toHaveBeenCalledOnce()
})

it('rejects a runner subset before any network execution', () => {
  const m = manager()
  expect(() =>
    m.propose({
      action: 'runCollection',
      summary: 'Only one',
      folderId: 10,
      requestIds: [1],
    }),
  ).toThrow('HTTP_RUN_INVALID_ORDER')
  expect(state.start).not.toHaveBeenCalled()
})
