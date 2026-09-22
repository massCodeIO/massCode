import { EventEmitter } from 'node:events'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyHttpRuntime } from '../../../shared/httpRuntime'
import { HttpCookieJar } from '../../http/cookies/jar'
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
  disconnect: vi.fn(),
  dispose: vi.fn(),
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
    history: { getEntries: () => [] },
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
    view: {
      runId: 'run',
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
  await expect(m.apply(proposal.id)).rejects.toThrow('ACTION_ALREADY_USED')
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
  expect(applied.view.state).toBe('done')
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

it.each(['connecting', 'error'])(
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
      connectionState === 'connecting' ? 'done' : 'failed',
    )
    expect(Boolean(result.webSocket)).toBe(connectionState === 'connecting')
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
