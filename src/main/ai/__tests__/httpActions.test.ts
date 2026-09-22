import { EventEmitter } from 'node:events'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyHttpRuntime } from '../../../shared/httpRuntime'
import { createHttpActionManager } from '../httpActions'

const fixture = vi.hoisted(() => ({
  vault: '/vault',
  execute: vi.fn(),
  active: 1,
  record: {} as any,
  folders: [] as any[],
}))
vi.mock('../../http/runtime/ownedExecution', () => ({
  executeOwnedHttpRequest: fixture.execute,
}))
vi.mock('../vault', () => ({ vaultIdentity: () => fixture.vault }))
vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: () => ({ transport: {}, skipCertificateVerification: false }),
    },
  },
}))
vi.mock('../../storage', () => ({
  useHttpStorage: () => ({
    requests: { getRequestById: () => fixture.record },
    folders: { getFolders: () => fixture.folders },
    environments: {
      getActiveEnvironmentId: () => fixture.active,
      getEnvironments: () => [{ id: 1, variables: {} }],
    },
  }),
}))
const owner = Object.assign(new EventEmitter(), { id: 1 }) as any
beforeEach(() => {
  fixture.vault = '/vault'
  fixture.active = 1
  fixture.folders = []
  fixture.record = {
    id: 1,
    name: 'Request',
    protocol: 'http',
    runtimeState: 'ready',
    runtimeRevision: 'r1',
    method: 'POST',
    url: 'https://example.test',
    headers: [],
    query: [],
    bodyType: 'json',
    body: '{}',
    formData: [],
    auth: { type: 'bearer', token: 'private-token' },
    runtime: emptyHttpRuntime(),
  }
  fixture.execute.mockReset().mockResolvedValue({
    status: 200,
    body: 'private-token',
    durationMs: 2,
    sizeBytes: 13,
    truncated: false,
  })
})
const intent = {
  action: 'send',
  source: 'saved',
  requestId: 1,
  summary: 'Send requested request',
}
function draft() {
  const {
    method,
    url,
    headers,
    query,
    bodyType,
    body,
    formData,
    auth,
    runtime,
  } = fixture.record
  return {
    contextId: '11111111-1111-4111-8111-111111111111',
    requestId: 1,
    environmentId: 1,
    request: { method, url, headers, query, bodyType, body, formData, auth },
    runtime,
    transport: {},
    skipCertificateVerification: false,
  }
}
it('prepares without network and executes exactly once with private auth but publishes no credential', async () => {
  const manager = createHttpActionManager(owner)
  const proposal = manager.propose(intent)
  expect(fixture.execute).not.toHaveBeenCalled()
  expect(JSON.stringify(proposal)).not.toContain('private-token')
  const result = await manager.apply(proposal.id)
  expect(fixture.execute.mock.calls[0][1].request.auth.token).toBe(
    'private-token',
  )
  expect(result.view.state).toBe('done')
  expect(JSON.stringify(result.view)).not.toContain('private-token')
  await expect(manager.apply(proposal.id)).rejects.toThrow(
    'ACTION_ALREADY_USED',
  )
})
it.each(['request', 'runtime', 'folder', 'environment', 'vault'])(
  'rejects stale %s before execution',
  async (kind) => {
    const manager = createHttpActionManager(owner)
    const proposal = manager.propose(intent)
    if (kind === 'request')
      fixture.record.url += '/changed'
    if (kind === 'runtime')
      fixture.record.runtimeRevision = 'r2'
    if (kind === 'folder')
      fixture.folders.push({ id: 7 })
    if (kind === 'environment')
      fixture.active = 2
    if (kind === 'vault')
      fixture.vault = '/other'
    await expect(manager.apply(proposal.id)).rejects.toThrow('ACTION_STALE')
    expect(fixture.execute).not.toHaveBeenCalled()
  },
)
it('requires exact fresh draft, keeps it immutable, and does not substitute saved contents', async () => {
  const manager = createHttpActionManager(owner)
  const snapshot = draft()
  snapshot.request.body = '{"draft":true}'
  const proposal = manager.propose({ ...intent, source: 'draft' }, snapshot)
  const fresh = structuredClone(snapshot)
  snapshot.request.body = 'changed'
  await expect(manager.apply(proposal.id, snapshot)).rejects.toThrow(
    'ACTION_STALE',
  )
  await manager.apply(proposal.id, fresh)
  expect(fixture.execute.mock.calls[0][1].request.body).toBe('{"draft":true}')
})
it('cancels owned pending/running actions and isolates managers', async () => {
  const manager = createHttpActionManager(owner)
  const proposal = manager.propose(intent)
  expect(() =>
    createHttpActionManager(owner).control(proposal.id, 'cancel'),
  ).toThrow('ACTION_UNAVAILABLE')
  fixture.execute.mockImplementation(
    (_owner, _payload, signal) =>
      new Promise(resolve =>
        signal.addEventListener('abort', () =>
          resolve({ status: null, error: 'cancelled' })),
      ),
  )
  const applying = manager.apply(proposal.id)
  manager.control(proposal.id, 'cancel')
  expect((await applying).view.state).toBe('cancelled')
})
it('draft mutation awaits renderer acknowledgement and save failure is never reported as saved', async () => {
  const manager = createHttpActionManager(owner)
  const snapshot = draft()
  const proposal = manager.propose(
    { action: 'saveDraft', summary: 'Save' },
    snapshot,
  )
  expect((await manager.apply(proposal.id, snapshot)).view.state).toBe(
    'running',
  )
  expect((await manager.complete(proposal.id, false)).view).toMatchObject({
    state: 'failed',
    result: { saved: 'unknown', sent: false },
  })
  expect(fixture.execute).not.toHaveBeenCalled()
  await expect(manager.complete(proposal.id, true)).rejects.toThrow(
    'ACTION_UNAVAILABLE',
  )
})

it('validates file references against the effective draft and exact existing references', () => {
  const manager = createHttpActionManager(owner)
  const snapshot = draft()
  snapshot.request.bodyType = 'binary'
  snapshot.request.body = '/private/secret.backup'
  const patch = (body: string) => ({
    action: 'patchDraft',
    summary: 'Body',
    fields: { body },
  })
  expect(() =>
    manager.propose(patch('/new/not-user-supplied'), snapshot),
  ).toThrow('FILE_REFERENCE_NOT_REQUESTED')
  expect(() => manager.propose(patch('/private/secret'), snapshot)).toThrow(
    'FILE_REFERENCE_NOT_REQUESTED',
  )
  expect(manager.propose(patch('/private/secret.backup'), snapshot).state).toBe(
    'pending',
  )
  expect(
    manager.propose(patch('/explicit/new'), snapshot, ['Use /explicit/new'])
      .state,
  ).toBe('pending')
  fixture.record.bodyType = 'binary'
  fixture.record.body = '/saved/file'
  snapshot.request.bodyType = 'text'
  snapshot.request.body = 'plain text'
  expect(manager.propose(patch('new ordinary text'), snapshot).state).toBe(
    'pending',
  )
})
it('retains bounded real saved response context even when the target is not open', async () => {
  const { createHistorySnapshot } = await import('../../http/historySnapshot')
  fixture.execute.mockImplementation(
    async (_owner, payload, _signal, onSnapshot) => {
      const result = {
        status: 200,
        body: `fresh-response private-token ${'x'.repeat(20000)}`,
        bodyKind: 'text' as const,
        statusText: 'OK',
        headers: [],
        durationMs: 2,
        sizeBytes: 20030,
        truncated: false,
      }
      onSnapshot(
        createHistorySnapshot(
          {
            method: payload.request.method,
            url: payload.request.url,
            headers: [],
            body: payload.request.body,
          },
          result,
          ['private-token'],
        ),
      )
      return result
    },
  )
  const manager = createHttpActionManager(owner)
  const proposal = manager.propose(intent)
  const result = await manager.apply(proposal.id)
  const status = manager.control(proposal.id, 'status')
  expect(status.result).toMatchObject({
    responseContext: {
      requestId: 1,
      source: 'saved',
      request: { method: 'POST', url: 'https://example.test/' },
      response: {
        body: expect.stringContaining('fresh-response [REDACTED]'),
        truncated: true,
      },
    },
  })
  expect(JSON.stringify(status)).not.toContain('private-token')
  expect(JSON.stringify(status).length).toBeLessThan(19000)
  expect(result.execution!.payload.request.auth.token).toBe('private-token')
})

it('patchAndSend waits for the trusted exact draft acknowledgement and preserves omitted auth', async () => {
  const manager = createHttpActionManager(owner)
  const snapshot = draft()
  const proposal = manager.propose(
    {
      action: 'patchAndSend',
      summary: 'Change and send',
      fields: { url: 'https://example.test/new' },
    },
    snapshot,
  )
  expect((await manager.apply(proposal.id, snapshot)).draftAction?.action).toBe(
    'patchAndSend',
  )
  expect(fixture.execute).not.toHaveBeenCalled()
  const fresh = {
    ...snapshot,
    contextId: '22222222-2222-4222-8222-222222222222',
    request: { ...snapshot.request, url: 'https://example.test/new' },
  }
  expect((await manager.complete(proposal.id, true, fresh)).view.state).toBe(
    'done',
  )
  expect(fixture.execute.mock.calls[0][1].request).toMatchObject({
    url: fresh.request.url,
    auth: { token: 'private-token' },
  })
  await expect(manager.complete(proposal.id, true, fresh)).rejects.toThrow(
    'ACTION_UNAVAILABLE',
  )
})
it('saveAndSend never sends after SaveFail, and reports its applied draft as a partial result', async () => {
  const manager = createHttpActionManager(owner)
  const snapshot = draft()
  const proposal = manager.propose(
    {
      action: 'saveAndSend',
      summary: 'Save and send',
      fields: { url: 'https://example.test/new' },
    },
    snapshot,
  )
  await manager.apply(proposal.id, snapshot)
  const fresh = {
    ...snapshot,
    request: { ...snapshot.request, url: 'https://example.test/new' },
  }
  expect(
    (await manager.complete(proposal.id, false, fresh)).view,
  ).toMatchObject({
    state: 'failed',
    result: { draftApplied: true, saved: 'unknown', sent: false },
  })
  expect(fixture.execute).not.toHaveBeenCalled()
})
it('saveAndSend verifies the saved definition and other state before sending once', async () => {
  const manager = createHttpActionManager(owner)
  const snapshot = draft()
  snapshot.request.url = 'https://example.test/unsaved'
  const proposal = manager.propose(
    { action: 'saveAndSend', summary: 'Save and send' },
    snapshot,
  )
  await manager.apply(proposal.id, snapshot)
  fixture.record.url = snapshot.request.url
  fixture.record.updatedAt = 99
  fixture.record.runtimeRevision = 'r2'
  expect(
    (await manager.complete(proposal.id, true, snapshot)).view,
  ).toMatchObject({ state: 'done', result: { saved: true, sent: true } })
  expect(fixture.execute).toHaveBeenCalledOnce()
})

it.each([
  ['patchAndSend', { url: 'https://example.test/?page=2' }],
  [
    'patchAndSend',
    { query: [{ key: 'page', value: '2', enabled: true, description: '' }] },
  ],
  ['saveAndSend', { url: 'https://example.test/?page=2' }],
  [
    'saveAndSend',
    { query: [{ key: 'page', value: '2', enabled: true, description: '' }] },
  ],
])(
  'normalizes %s URL/Params before its exact acknowledgement',
  async (action, fields) => {
    const manager = createHttpActionManager(owner)
    const snapshot = draft()
    snapshot.request.url = 'https://example.test/'
    const proposal = manager.propose(
      { action, fields, summary: 'Send parameters' },
      snapshot,
    )
    await manager.apply(proposal.id, snapshot)
    const fresh = {
      ...snapshot,
      request: {
        ...snapshot.request,
        url: 'https://example.test/?page=2',
        query: [{ key: 'page', value: '2', enabled: true, description: '' }],
      },
    }
    if (action === 'saveAndSend') {
      fixture.record.url = 'https://example.test/'
      fixture.record.query = fresh.request.query
      fixture.record.updatedAt = 99
      fixture.record.runtimeRevision = 'r2'
    }
    expect((await manager.complete(proposal.id, true, fresh)).view.state).toBe(
      'done',
    )
    expect(fixture.execute).toHaveBeenCalledOnce()
  },
)

it.each(['patchAndSend', 'saveAndSend'])(
  'normalizes %s runtime encoding changes and reset to inherited defaults',
  async (action) => {
    for (const reset of [false, true]) {
      fixture.execute.mockClear()
      const manager = createHttpActionManager(owner)
      const snapshot = draft()
      snapshot.request.query = [
        { key: 'q', value: 'a b', description: '', enabled: true },
      ]
      snapshot.request.url = reset
        ? 'https://example.test/?q=a b'
        : 'https://example.test/?q=a%20b'
      snapshot.runtime = {
        ...emptyHttpRuntime(),
        version: 2,
        transport: { encodeUrl: !reset },
      }
      const runtime = {
        ...emptyHttpRuntime(),
        version: 2 as const,
        ...(reset ? {} : { transport: { encodeUrl: false } }),
      }
      const proposal = manager.propose(
        { action, summary: 'Change encoding and send', fields: { runtime } },
        snapshot,
      )
      await manager.apply(proposal.id, snapshot)
      const fresh = {
        ...snapshot,
        runtime,
        request: {
          ...snapshot.request,
          url: reset
            ? 'https://example.test/?q=a%20b'
            : 'https://example.test/?q=a b',
        },
      }
      if (action === 'saveAndSend') {
        Object.assign(fixture.record, fresh.request, {
          url: 'https://example.test/',
          runtime,
          runtimeRevision: reset ? 'r3' : 'r2',
        })
      }
      const result = (await manager.complete(proposal.id, true, fresh)).view
      expect(result, JSON.stringify(result.result)).toMatchObject({
        state: 'done',
      })
      expect(fixture.execute).toHaveBeenCalledOnce()
    }
  },
)

it.each(['http', 'websocket'])(
  'saveAndSend recognizes the persisted HTTP default but rejects a change to %s',
  async (protocol) => {
    delete fixture.record.protocol
    const manager = createHttpActionManager(owner)
    const snapshot = { ...draft(), protocol: 'http' as const }
    const proposal = manager.propose(
      {
        action: 'saveAndSend',
        summary: 'Save and send query',
        fields: {
          query: [{ key: 'q', value: 'кофе с молоком & чай', enabled: true }],
        },
      },
      snapshot,
    )
    await manager.apply(proposal.id, snapshot)
    const query = [{ key: 'q', value: 'кофе с молоком & чай', enabled: true }]
    const fresh = {
      ...snapshot,
      request: {
        ...snapshot.request,
        query,
        url: 'https://example.test?q=%D0%BA%D0%BE%D1%84%D0%B5%20%D1%81%20%D0%BC%D0%BE%D0%BB%D0%BE%D0%BA%D0%BE%D0%BC%20%26%20%D1%87%D0%B0%D0%B9',
      },
    }
    Object.assign(fixture.record, { query, protocol, updatedAt: 99 })
    const result = await manager.complete(proposal.id, true, fresh)
    expect(result.view.result).toMatchObject({
      draftApplied: true,
      saved: true,
    })
    expect(result.view.state).toBe(protocol === 'http' ? 'done' : 'failed')
    expect(fixture.execute).toHaveBeenCalledTimes(protocol === 'http' ? 1 : 0)
  },
)
