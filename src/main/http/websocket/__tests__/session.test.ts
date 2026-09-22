import type { WsConnect } from '../../../../shared/httpWebSocket'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { emptyHttpCollection } from '../../../../shared/httpCollection'
import {
  WS_MESSAGE_LIMIT,
  wsConnectSchema,
} from '../../../../shared/httpWebSocket'
import {
  commitHttpSession,
  getHttpSession,
  resetHttpSession,
} from '../../runtime/session'
import {
  clearWebSocket,
  connectWebSocket,
  disconnectWebSocket,
  disposeWebSocket,
  readWebSocket,
  readWebSocketForAi,
  sendWebSocket,
} from '../session'

const mocks = vi.hoisted(() => ({
  envId: 1 as number | null,
  vault: '/vault',
  pending: false,
  folderId: null as number | null,
  folders: [] as any[],
}))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => mocks.vault,
}))
vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    folders: { getFolders: () => mocks.folders },
    requests: {
      getRequestById: () => ({
        id: 1,
        folderId: mocks.folderId,
        pendingCloudDownload: mocks.pending,
      }),
    },
    environments: { getActiveEnvironmentId: () => mocks.envId },
  }),
}))
vi.mock('../../secrets', () => ({ getEnvironmentSecrets: () => ({}) }))
vi.mock('../../runtime/execute', async importOriginal => ({
  ...(await importOriginal<typeof import('../../runtime/execute')>()),
  resolveEnvironment: () => ({
    variables: { token: 'env-value' },
    maskedVariables: { token: '••••••' },
    secretValues: ['env-value'],
  }),
}))

let server: WebSocketServer
let url: string
function input(): WsConnect {
  return {
    connectionId: randomUUID(),
    requestId: 1,
    environmentId: 1,
    url,
    headers: [],
    query: [],
    auth: { type: 'none' },
  }
}
async function waitFor(
  id: string,
  predicate: (view: ReturnType<typeof readWebSocket>) => boolean,
) {
  await vi.waitFor(() => expect(predicate(readWebSocket(1, id, 0))).toBe(true))
  return readWebSocket(1, id, 0)
}
beforeEach(async () => {
  mocks.envId = 1
  mocks.vault = '/vault'
  mocks.pending = false
  mocks.folderId = null
  mocks.folders = []
  resetHttpSession()
  server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(server, 'listening')
  url = `ws://127.0.0.1:${(server.address() as { port: number }).port}`
  server.on('connection', socket =>
    socket.on('message', (data, binary) => socket.send(data, { binary })))
})
afterEach(async () => {
  disposeWebSocket(1)
  disposeWebSocket(2)
  for (const socket of server.clients) socket.terminate()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe('webSocket sessions', () => {
  it.each(['header', 'query'] as const)(
    'sends direct and inherited API keys in %s',
    async (location) => {
      const config = emptyHttpCollection()
      config.auth = {
        type: 'apikey',
        key: 'X-QA-Key',
        value: '{{token}}',
        in: location,
      }
      mocks.folders = [{ id: 10, parentId: null, collectionConfig: config }]
      mocks.folderId = 10
      for (const inherited of [false, true]) {
        const request = wsConnectSchema.parse({
          ...input(),
          url: `${url}?keep=1`,
          auth: inherited ? { type: 'inherit' } : config.auth,
        })
        const connected = once(server, 'connection')
        connectWebSocket(1, request)
        const [, handshake] = await connected
        const query = new URL(handshake.url, url).searchParams
        expect(query.get('keep')).toBe('1')
        expect(
          location === 'header'
            ? handshake.headers['x-qa-key']
            : query.get('X-QA-Key'),
        ).toBe('env-value')
        disposeWebSocket(1)
      }
    },
  )

  it('uses the same inherited headers, credentials and variable precedence in the handshake', async () => {
    const config = emptyHttpCollection()
    config.headers = [{ key: 'X-Inherited', value: '{{collectionValue}}' }]
    config.variables = [
      { key: 'collectionValue', value: 'collection' },
      { key: 'token', value: 'collection-token' },
    ]
    config.auth = { type: 'bearer', token: '{{token}}' }
    mocks.folders = [
      { id: 10, parentId: null, createdAt: 100, collectionConfig: config },
    ]
    mocks.folderId = 10
    const session = getHttpSession('/vault', 1)
    commitHttpSession(
      session.generation,
      new Map([['token', 'session-token']]),
    )
    const request = input()
    request.auth = { type: 'inherit' }
    request.headers = [
      { key: 'x-inherited', value: 'disabled', enabled: false },
    ]
    const connected = once(server, 'connection')
    connectWebSocket(1, request)
    const [, handshake] = await connected
    expect(handshake.headers['x-inherited']).toBe('collection')
    expect(handshake.headers.authorization).toBe('Bearer session-token')
  })

  it('blocks invalid synced collection configuration before opening a socket', () => {
    mocks.folders = [
      {
        id: 10,
        parentId: null,
        createdAt: 100,
        collectionConfig: { version: 999 },
      },
    ]
    mocks.folderId = 10
    expect(() => connectWebSocket(1, input())).toThrow(
      'HTTP_COLLECTION_INVALID',
    )
  })

  it('connects, sends text, receives echoes and closes', async () => {
    const request = input()
    connectWebSocket(1, request)
    await waitFor(request.connectionId, view => view.state === 'open')
    await sendWebSocket(1, request.connectionId, '{"hello":true}')
    const view = await waitFor(
      request.connectionId,
      view => view.messages.length === 2,
    )
    expect(view.messages.map(m => m.direction).sort()).toEqual([
      'incoming',
      'outgoing',
    ])
    expect(view.messages.every(m => m.text === '{"hello":true}')).toBe(true)
    disconnectWebSocket(1, request.connectionId)
    await waitFor(request.connectionId, view => view.state === 'closed')
  })

  it('snapshots variables, applies headers/auth/query and masks outgoing values', async () => {
    const session = getHttpSession('/vault', 1)
    commitHttpSession(
      session.generation,
      new Map([['token', 'session-value']]),
    )
    const request = {
      ...input(),
      query: [{ key: 'token', value: '{{token}}' }],
      headers: [{ key: 'X-Test', value: '{{token}}' }],
      auth: { type: 'bearer' as const, token: '{{token}}' },
    }
    const connected = once(server, 'connection')
    connectWebSocket(1, request)
    const [, handshake] = await connected
    expect(handshake.url).toBe('/?token=session-value')
    expect(handshake.headers['x-test']).toBe('session-value')
    expect(handshake.headers.authorization).toBe('Bearer session-value')
    await waitFor(request.connectionId, view => view.state === 'open')
    commitHttpSession(session.generation, new Map([['token', 'changed']]))
    await sendWebSocket(1, request.connectionId, '{{token}}')
    const view = await waitFor(
      request.connectionId,
      view => view.messages.length === 2,
    )
    expect(view.messages.find(m => m.direction === 'incoming')?.text).toBe(
      'session-value',
    )
    expect(view.messages.find(m => m.direction === 'outgoing')?.text).toBe(
      '••••••',
    )
  })

  it('isolates owners and ignores stale disposal after reconnecting', async () => {
    const first = input()
    connectWebSocket(1, first)
    expect(() => readWebSocket(2, first.connectionId, 0)).toThrow(
      'WS_UNAVAILABLE',
    )
    const second = input()
    connectWebSocket(1, second)
    disposeWebSocket(1, first.connectionId)
    expect(readWebSocket(1, second.connectionId, 0).connectionId).toBe(
      second.connectionId,
    )
  })

  it.each([400, 401, 403])(
    'reports HTTP %s handshake rejection without leaking response data',
    async (status) => {
      server.options.verifyClient = (_info, done) =>
        done(false, status, 'sensitive-server-detail', {
          'X-Secret': 'hidden-token',
        })
      const request = input()
      connectWebSocket(1, request)
      const view = await waitFor(
        request.connectionId,
        view => view.state === 'error',
      )
      expect(view).toMatchObject({
        error: 'handshake',
        handshakeStatus: status,
        messages: [],
      })
      expect(JSON.stringify(view)).not.toMatch(
        /sensitive-server-detail|hidden-token/,
      )
      await expect(
        sendWebSocket(1, request.connectionId, 'not connected'),
      ).rejects.toThrow('WS_NOT_OPEN')

      server.options.verifyClient = undefined
      const retry = input()
      connectWebSocket(1, retry)
      await waitFor(retry.connectionId, view => view.state === 'open')
      expect(readWebSocket(1, retry.connectionId, 0).error).toBeUndefined()
    },
  )

  it('uses current connection settings only after reconnecting and applies real basic auth', async () => {
    const request = {
      ...input(),
      query: [{ key: 'channel', value: 'notifications' }],
      headers: [{ key: 'X-Client-ID', value: 'first' }],
      auth: { type: 'basic' as const, username: 'demo', password: 'password' },
    }
    const connected = once(server, 'connection')
    connectWebSocket(1, request)
    const [, first] = await connected
    expect(first.url).toBe('/?channel=notifications')
    expect(first.headers['x-client-id']).toBe('first')
    expect(first.headers.authorization).toBe(
      `Basic ${Buffer.from('demo:password').toString('base64')}`,
    )
    await waitFor(request.connectionId, view => view.state === 'open')
    request.query[0].value = 'updates'
    request.headers[0].value = 'second'
    expect(first.url).toBe('/?channel=notifications')
    disconnectWebSocket(1, request.connectionId)
    await waitFor(request.connectionId, view => view.state === 'closed')
    const reconnected = once(server, 'connection')
    connectWebSocket(1, { ...request, connectionId: randomUUID() })
    const [, second] = await reconnected
    expect(second.url).toBe('/?channel=updates')
    expect(second.headers['x-client-id']).toBe('second')
  })

  it.each(['environment', 'vault', 'session'])(
    'closes after %s changes',
    async (context) => {
      const request = input()
      connectWebSocket(1, request)
      await waitFor(request.connectionId, view => view.state === 'open')
      if (context === 'environment')
        mocks.envId = 2
      if (context === 'vault')
        mocks.vault = '/other'
      if (context === 'session')
        resetHttpSession()
      expect(readWebSocket(1, request.connectionId, 0).error).toBe(
        'contextChanged',
      )
      await expect(
        sendWebSocket(1, request.connectionId, 'no'),
      ).rejects.toThrow('WS_CONTEXT_CHANGED')
    },
  )

  it('bounds the log and previews, supports binary reception and clearing', async () => {
    const request = input()
    const connected = once(server, 'connection')
    connectWebSocket(1, request)
    const [socket] = await connected
    await waitFor(request.connectionId, view => view.state === 'open')
    for (let i = 0; i < 110; i++) socket.send(String(i))
    const view = await waitFor(
      request.connectionId,
      view => view.lastId === 110,
    )
    expect(view.messages).toHaveLength(100)
    expect(view.dropped).toBe(10)
    const after = clearWebSocket(1, request.connectionId)
    socket.send(Buffer.alloc(20000, 1))
    const binary = await waitFor(
      request.connectionId,
      view => view.lastId > after,
    )
    expect(binary.messages[0]).toMatchObject({
      kind: 'binary',
      truncated: true,
      bytes: 20000,
    })
    expect(binary.messages[0].text.length).toBeLessThanOrEqual(16384)
    expect(binary.dropped).toBe(0)
    expect(
      readWebSocket(1, request.connectionId, binary.lastId).messages,
    ).toEqual([])
  })

  it('rejects unsafe URLs, unavailable drafts and oversized sends', async () => {
    expect(() =>
      connectWebSocket(1, { ...input(), url: 'file:///tmp/secret' }),
    ).toThrow('WS_INVALID')
    expect(() =>
      connectWebSocket(1, { ...input(), url: 'ws://user:pass@localhost/' }),
    ).toThrow('WS_INVALID')
    expect(() =>
      connectWebSocket(1, {
        ...input(),
        headers: [{ key: 'Host', value: 'other' }],
      }),
    ).toThrow('WS_INVALID')
    mocks.pending = true
    expect(() => connectWebSocket(1, input())).toThrow('WS_UNAVAILABLE')
    mocks.pending = false
    const request = input()
    connectWebSocket(1, request)
    await waitFor(request.connectionId, view => view.state === 'open')
    await expect(
      sendWebSocket(1, request.connectionId, 'я'.repeat(WS_MESSAGE_LIMIT)),
    ).rejects.toThrow('WS_TOO_LARGE')
  })

  it('rejects oversized incoming messages without retaining them', async () => {
    const request = input()
    const connected = once(server, 'connection')
    connectWebSocket(1, request)
    const [socket] = await connected
    await waitFor(request.connectionId, view => view.state === 'open')
    socket.send(Buffer.alloc(WS_MESSAGE_LIMIT + 1))
    const view = await waitFor(
      request.connectionId,
      view => view.state === 'error',
    )
    expect(view.error).toBe('tooLarge')
    expect(view.messages).toHaveLength(0)
  })
})

it('redacts echoed auth/environment/session secrets for AI without changing the raw UI log', async () => {
  const request = {
    ...input(),
    auth: { type: 'bearer' as const, token: 'literal-auth' },
  }
  const session = getHttpSession(mocks.vault, mocks.envId)
  commitHttpSession(
    session.generation,
    new Map([['session', 'session-value']]),
  )
  connectWebSocket(1, request)
  await waitFor(request.connectionId, view => view.state === 'open')
  const message = 'literal-auth env-value session-value'
  for (const socket of server.clients)
    socket.send(JSON.stringify({ ordinary: message }))
  await waitFor(request.connectionId, view => view.messages.length > 0)
  expect(JSON.stringify(readWebSocket(1, request.connectionId, 0))).toContain(
    message,
  )
  const safe = JSON.stringify(readWebSocketForAi(1, request.connectionId, 0))
  expect(safe).not.toContain('literal-auth')
  expect(safe).not.toContain('env-value')
  expect(safe).not.toContain('session-value')
  expect(safe).toContain('[REDACTED]')
})
