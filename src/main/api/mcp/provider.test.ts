import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resetHttpRuntimeCache } from '../../storage/providers/markdown/http/runtime/sync'
import { createHttpFoldersStorage } from '../../storage/providers/markdown/http/storages/folders'
import { createHttpHistoryStorage } from '../../storage/providers/markdown/http/storages/history'
import { createHttpRequestsStorage } from '../../storage/providers/markdown/http/storages/requests'
import { resetNotesRuntimeCache } from '../../storage/providers/markdown/notes/runtime/sync'
import { createNotesFoldersStorage } from '../../storage/providers/markdown/notes/storages/folders'
import { createNotesNotesStorage } from '../../storage/providers/markdown/notes/storages/notes'
import { resetRuntimeCache } from '../../storage/providers/markdown/runtime/sync'
import { createSnippetsStorage } from '../../storage/providers/markdown/storages/snippets'
import httpRequestsRoute from '../routes/http-requests'
import { createMcpRoute } from './route'

let vaultPath = ''
let historyLimit = 20
vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir(), isReady: () => false },
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null },
}))
vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: (key: string) =>
        key === 'storage.vaultPath'
          ? vaultPath
          : key === 'http'
            ? { historyLimit }
            : key === 'api.mcp.enabled',
    },
  },
}))
vi.mock('../integrations/auth', () => ({
  isIntegrationTokenAuthorized: () => true,
}))
vi.mock('../../storage', () => ({
  useHttpStorage: () => ({
    folders: createHttpFoldersStorage(),
    requests: createHttpRequestsStorage(),
    environments: { getActiveEnvironmentId: () => null },
    history: createHttpHistoryStorage(),
  }),
  useStorage: () => ({ snippets: createSnippetsStorage() }),
  useNotesStorage: () => ({ notes: createNotesNotesStorage() }),
}))

vi.mock('../../http/cookies/store', () => ({
  getHttpCookieJar: () => ({ enabled: () => false }),
}))
vi.mock('../../http/secrets', () => ({ getEnvironmentSecrets: () => ({}) }))

beforeEach(() => {
  historyLimit = 20
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-mcp-'))
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
})
afterEach(() => {
  vi.restoreAllMocks()
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
  fs.removeSync(vaultPath)
})

it('reports the persisted note ID when backlink rewriting fails during creation', async () => {
  const notes = createNotesNotesStorage()
  const folder = createNotesFoldersStorage().createFolder({
    name: 'Folder',
    parentId: null,
  })
  notes.createNote({ name: 'Foo', folderId: folder.id })
  const linker = notes.createNote({ name: 'Linker', folderId: folder.id })
  notes.updateNoteContent(linker.id, 'See [[Foo]]')
  const writeFile = fs.writeFileSync
  vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
    if (String(args[0]).endsWith('/Linker.md')) {
      throw new Error('EACCES: private linker path')
    }
    return writeFile(...args)
  })

  const response = await toolCall('create_note', {
    name: 'Foo',
    content: 'new content',
  })
  expect(response.isError).toBe(true)
  const error = JSON.parse(response.content[0].text)
  expect(error).toMatchObject({
    code: 'PARTIAL_CREATE',
    type: 'note',
    retryable: false,
  })
  expect(error.id).toBeGreaterThan(linker.id)
  expect(response.content[0].text).not.toContain('private linker path')
  expect(notes.getNoteById(error.id)).toMatchObject({
    name: 'Foo',
    content: '',
    folder: null,
  })
  vi.restoreAllMocks()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
  expect(notes.getNoteById(error.id)?.name).toBe('Foo')
})

async function toolCall(name: string, args: Record<string, unknown>) {
  const response = await createMcpRoute(4321, 'test').handle(
    new Request('http://localhost:4321/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  )
  expect(response.status).toBe(200)
  const text = await response.text()
  const payload = JSON.parse(
    text.startsWith('event:') ? text.split('data: ')[1].trim() : text,
  )
  return payload.result
}

async function call(name: string, args: Record<string, unknown>) {
  const result = await toolCall(name, args)
  expect(result.isError, JSON.stringify(result)).not.toBe(true)
  return JSON.parse(result.content[0].text)
}

it.each([
  'typescript\ninjected',
  'typescript\rinjected',
  '`typescript',
  '\ntypescript',
])(
  'rejects unsafe language %j before creating a vault item',
  async (language) => {
    const response = await toolCall('create_snippet', {
      name: 'Unsafe',
      content: 'const safe = true',
      language,
    })
    expect(response.isError).toBe(true)
    expect(createSnippetsStorage().getSnippets({})).toHaveLength(0)
  },
)

it('preserves a custom language and code after reloading the vault', async () => {
  const content = 'const safe = true\n'
  const snippet = await call('create_snippet', {
    name: 'Custom',
    content,
    language: 'custom-language_v2',
  })
  resetRuntimeCache()
  const stored = await call('get_item', { type: 'snippet', id: snippet.id })
  expect(stored.contents[0]).toMatchObject({
    language: 'custom-language_v2',
    value: content,
  })
})

it.each(['a\r\nb\r\n', 'a\rb\r', '\r', 'a\r\nb\nc\rd\r', 'a\r\n```\r\nb\r'])(
  'preserves exact line endings after reloading snippets and notes: %j',
  async (content) => {
    const snippet = await call('create_snippet', {
      name: 'Line endings snippet',
      content,
    })
    const note = await call('create_note', {
      name: 'Line endings note',
      content,
    })
    resetRuntimeCache()
    resetNotesRuntimeCache()
    resetHttpRuntimeCache()
    expect(
      (await call('get_item', { type: 'snippet', id: snippet.id })).contents[0]
        .value,
    ).toBe(content)
    expect(
      (await call('get_item', { type: 'note', id: note.id })).content,
    ).toBe(content)
  },
)

it('persists Inbox items through the real Markdown providers and finds their full text after cache reset', async () => {
  const content = '  uniqueMcpContent\n\n```typescript\nconst x = 1\n```\n  '
  const snippet = await call('create_snippet', { name: 'Snippet', content })
  const note = await call('create_note', { name: 'Note', content })
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
  const storedSnippet = await call('get_item', {
    type: 'snippet',
    id: snippet.id,
  })
  const storedNote = await call('get_item', { type: 'note', id: note.id })
  expect(storedSnippet.folder).toBeNull()
  expect(storedSnippet.contents).toHaveLength(1)
  expect(storedSnippet.contents[0].value).toBe(content)
  expect(storedNote.folder).toBeNull()
  expect(storedNote.content).toBe(content)
  const search = await call('search', { query: 'uniqueMcpContent' })
  expect(
    search.items.map((item: { type: string }) => item.type).sort(),
  ).toEqual(['note', 'snippet'])
})

it.each([
  ['ASCII', 'x'],
  ['Unicode', 'я'],
  ['newlines', '\n'],
  ['quotes', '"'],
  ['control characters', '\u0001'],
])(
  'round-trips 256 KiB of %s through creation and reading after cache reset',
  async (_name, unit) => {
    const content = unit.repeat((256 * 1024) / Buffer.byteLength(unit, 'utf8'))
    const snippet = await call('create_snippet', {
      name: 'Boundary snippet',
      content,
    })
    const note = await call('create_note', { name: 'Boundary note', content })
    resetRuntimeCache()
    resetNotesRuntimeCache()
    resetHttpRuntimeCache()
    expect(
      (await call('get_item', { type: 'snippet', id: snippet.id })).contents[0]
        .value,
    ).toBe(content)
    expect(
      (await call('get_item', { type: 'note', id: note.id })).content,
    ).toBe(content)
  },
)

it('creates, searches and reloads HTTP requests without sending them', async () => {
  const created = await call('create_http_request', {
    name: 'Example API',
    method: 'POST',
    url: '{{baseUrl}}/example',
    headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
    bodyType: 'json',
    body: '{"line":"hello"}\r\n',
    description: 'Description',
  })
  resetHttpRuntimeCache()
  const item = await call('get_item', { type: 'http_request', id: created.id })
  expect(item).toMatchObject({
    name: 'Example API',
    method: 'POST',
    folderId: null,
    body: '{"line":"hello"}\r\n',
  })
  const found = await call('search', {
    query: 'example',
    type: 'http_request',
  })
  expect(found.items).toHaveLength(1)
  expect(found.items[0]).not.toHaveProperty('headers')
  expect(found.items[0]).not.toHaveProperty('body')
  createHttpRequestsStorage().updateRequest(created.id, { isDeleted: 1 })
  expect(
    (await call('search', { query: 'example', type: 'http_request' })).items,
  ).toHaveLength(0)
  expect(
    (await toolCall('get_item', { type: 'http_request', id: created.id }))
      .isError,
  ).toBe(true)
})

it('rejects oversized HTTP content before creating a request', async () => {
  const response = await toolCall('create_http_request', {
    name: 'Large',
    url: 'https://example.test',
    body: 'x'.repeat(256 * 1024),
    description: 'x',
  })
  expect(response.isError).toBe(true)
  expect(createHttpRequestsStorage().getRequests()).toHaveLength(0)
})

it('sends a saved request through the real HTTP executor and caps its response', async () => {
  let sent = 0
  const server = createServer((request, response) => {
    sent += 1
    expect(request.method).toBe('POST')
    expect(request.url).toBe('/smoke?source=mcp')
    response.setHeader('content-type', 'text/plain')
    response.setHeader('set-cookie', 'secret-session=private-cookie')
    response.end('x'.repeat(300 * 1024))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  try {
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No test server address')
    const created = await call('create_http_request', {
      name: 'HTTP smoke',
      headers: [{ key: 'Authorization', value: 'Bearer private-auth' }],
      method: 'POST',
      url: `http://127.0.0.1:${address.port}/smoke`,
      query: [{ key: 'source', value: 'mcp' }],
      bodyType: 'text',
      body: 'hello',
    })
    const response = await call('execute_http_request', { id: created.id })
    expect(response.status).toBe(200)
    expect(response.historyId).toBeGreaterThan(0)
    const history = await call('get_http_history', { id: response.historyId })
    expect(history.response.status).toBe(200)
    expect(history.request.url).toContain('/smoke?source=mcp')
    expect(JSON.stringify(history)).not.toContain('private-auth')
    expect(JSON.stringify(history)).not.toContain('private-cookie')
    expect(response.truncated).toBe(true)
    expect(Buffer.byteLength(response.body, 'utf8')).toBe(256 * 1024)
    expect(sent).toBe(1)
  }
  finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    )
  }
})

it('persists an HTTP collection and its request across cache reloads', async () => {
  const collection = await call('create_http_collection', { name: 'API' })
  expect(collection.type).toBe('http_collection')
  const request = await call('create_http_request', {
    name: 'Users',
    url: 'https://example.test/users',
    folderId: collection.id,
  })
  resetHttpRuntimeCache()
  expect(createHttpFoldersStorage().getFolders()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: collection.id,
        name: 'API',
        parentId: null,
      }),
    ]),
  )
  expect(
    await call('get_item', { type: 'http_request', id: request.id }),
  ).toMatchObject({
    folderId: collection.id,
    name: 'Users',
    auth: { type: 'inherit' },
  })
})

it('lists an empty collection tree even when unfiled requests exist', async () => {
  await call('create_http_request', {
    name: 'Unfiled request',
    url: 'https://example.test',
  })
  expect(await call('list_http_collections', {})).toEqual([])
})

it('lists persisted root collections and nested folders after reloading', async () => {
  const root = await call('create_http_collection', { name: 'API' })
  const child = createHttpFoldersStorage().createFolder({
    name: 'Users',
    parentId: root.id,
  })
  const request = await call('create_http_request', {
    name: 'List users',
    url: 'https://example.test/users',
    folderId: child.id,
  })
  resetHttpRuntimeCache()
  expect(await call('list_http_collections', {})).toEqual([
    {
      id: root.id,
      name: 'API',
      parentId: null,
      children: [
        { id: child.id, name: 'Users', parentId: root.id, children: [] },
      ],
    },
  ])
  expect(
    await call('get_item', { type: 'http_request', id: request.id }),
  ).toMatchObject({ folderId: child.id, auth: { type: 'inherit' } })
})

it('lists all HTTP requests, Unfiled or direct folder contents without trash, WebSockets or content', async () => {
  const folders = createHttpFoldersStorage()
  const requests = createHttpRequestsStorage()
  const root = folders.createFolder({ name: 'API', parentId: null })
  const child = folders.createFolder({ name: 'Users', parentId: root.id })
  const unfiled = requests.createRequest({ name: 'Unfiled', folderId: null })
  const direct = requests.createRequest({
    name: 'Root request',
    folderId: root.id,
  })
  const nested = requests.createRequest({
    name: 'Nested request',
    folderId: child.id,
  })
  requests.updateRequest(unfiled.id, {
    body: 'private-body',
    auth: { type: 'bearer', token: 'private-token' },
  })
  const trash = requests.createRequest({ name: 'Trash', folderId: null })
  requests.updateRequest(trash.id, { isDeleted: 1 })
  requests.createRequest({
    name: 'Socket',
    protocol: 'websocket',
    folderId: null,
  })
  resetHttpRuntimeCache()

  const all = await call('list_http_requests', {})
  expect(
    all.items
      .map((item: { id: number }) => item.id)
      .sort((a: number, b: number) => a - b),
  ).toEqual([unfiled.id, direct.id, nested.id])
  for (const item of all.items) {
    expect(Object.keys(item).sort()).toEqual(
      [
        'type',
        'id',
        'name',
        'method',
        'url',
        'folderId',
        'createdAt',
        'updatedAt',
        'pendingCloudDownload',
      ].sort(),
    )
  }
  expect(JSON.stringify(all)).not.toContain('private-')
  for (const [folderId, id] of [
    [null, unfiled.id],
    [root.id, direct.id],
    [child.id, nested.id],
  ]) {
    const page = await call('list_http_requests', { folderId })
    expect(page).toMatchObject({
      items: [{ id }],
      hasMore: false,
      nextOffset: null,
    })
    expect(page.items).toHaveLength(1)
  }
})

it('paginates HTTP requests by updatedAt descending and ID ascending with empty offsets', async () => {
  const requests = createHttpRequestsStorage()
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
  const older = requests.createRequest({ name: 'Older' })
  now.mockReturnValue(2000)
  const first = requests.createRequest({ name: 'First tie' })
  const second = requests.createRequest({ name: 'Second tie' })
  const page = await call('list_http_requests', { limit: 1 })
  expect(page).toMatchObject({
    items: [{ id: first.id }],
    hasMore: true,
    nextOffset: 1,
  })
  expect(page.items).toHaveLength(1)
  const rest = await call('list_http_requests', {
    offset: page.nextOffset,
    limit: 2,
  })
  expect(rest.items.map((item: { id: number }) => item.id)).toEqual([
    second.id,
    older.id,
  ])
  expect(rest).toMatchObject({ hasMore: false, nextOffset: null })
  expect(await call('list_http_requests', { offset: 3 })).toEqual({
    items: [],
    hasMore: false,
    nextOffset: null,
  })
  expect(await call('list_http_requests', { offset: 100 })).toEqual({
    items: [],
    hasMore: false,
    nextOffset: null,
  })
  expect(await call('list_http_requests', { folderId: 999 })).toEqual({
    items: [],
    hasMore: false,
    nextOffset: null,
  })
})

it.each([
  { folderId: 0 },
  { folderId: -1 },
  { folderId: 1.5 },
  { folderId: Number.MAX_SAFE_INTEGER + 1 },
  { offset: -1 },
  { limit: 0 },
  { limit: 101 },
])('rejects invalid HTTP list arguments %j', async (args) => {
  expect((await toolCall('list_http_requests', args)).isError).toBe(true)
})

it('patches saved fields with CAS, preserves omitted values and returns actual move names and auth', async () => {
  const storage = createHttpRequestsStorage()
  const root = createHttpFoldersStorage().createFolder({
    name: 'API',
    parentId: null,
  })
  const request = await call('create_http_request', {
    name: 'Users',
    folderId: root.id,
    url: 'https://example.test',
    bodyType: 'text',
    body: 'keep body',
    headers: [{ key: 'X-Keep', value: 'keep' }],
  })
  const before = await call('get_item', {
    type: 'http_request',
    id: request.id,
  })
  storage.createRequest({ name: 'Users', folderId: null })
  const moved = await call('update_http_request', {
    id: request.id,
    expectedRevision: before.contentRevision,
    patch: {
      folderId: null,
      description: 'changed',
      query: [{ key: 'q', value: '1' }],
    },
  })
  expect(moved).toMatchObject({
    type: 'http_request',
    folderId: null,
    name: 'Users 1',
  })
  expect(moved.contentRevision).not.toBe(before.contentRevision)
  const after = storage.getRequestById(request.id)!
  expect(after).toMatchObject({
    body: 'keep body',
    headers: [{ key: 'X-Keep', value: 'keep' }],
    auth: { type: 'inherit' },
    description: 'changed',
  })
  const file = path.join(vaultPath, 'http', after.filePath)
  const bytes = fs.readFileSync(file)
  const stale = await toolCall('update_http_request', {
    id: request.id,
    expectedRevision: before.contentRevision,
    patch: { body: 'stale' },
  })
  expect(JSON.parse(stale.content[0].text).code).toBe('CONFLICT')
  expect(fs.readFileSync(file)).toEqual(bytes)
  resetHttpRuntimeCache()
  expect(storage.getRequestById(request.id)!.contentRevision).toBe(
    moved.contentRevision,
  )
  storage.updateRequest(request.id, { isFavorites: 1 })
  expect(storage.getRequestById(request.id)!.contentRevision).toBe(
    moved.contentRevision,
  )
  const changed = await call('update_http_request', {
    id: request.id,
    expectedRevision: moved.contentRevision,
    patch: { headers: [], auth: { type: 'none' } },
  })
  expect(storage.getRequestById(request.id)).toMatchObject({
    headers: [],
    auth: { type: 'none' },
    contentRevision: changed.contentRevision,
  })
})

it('rejects unsafe HTTP patches and validates the combined final content before writing', async () => {
  const request = await call('create_http_request', {
    name: 'Saved',
    url: 'https://example.test',
    body: 'x'.repeat(256 * 1024),
  })
  const item = createHttpRequestsStorage().getRequestById(request.id)!
  for (const patch of [
    {},
    { protocol: 'websocket' },
    { runtime: {} },
    { name: '../bad' },
    { bodyType: 'binary' },
    { description: 'x' },
  ]) {
    const rejected = await toolCall('update_http_request', {
      id: request.id,
      expectedRevision: item.contentRevision,
      patch,
    })
    expect(rejected.isError).toBe(true)
    expect(
      createHttpRequestsStorage().getRequestById(request.id)!.contentRevision,
    ).toBe(item.contentRevision)
  }
  createHttpRequestsStorage().updateRequest(request.id, { isDeleted: 1 })
  expect(
    (
      await toolCall('update_http_request', {
        id: request.id,
        expectedRevision: item.contentRevision,
        patch: { body: 'x' },
      })
    ).isError,
  ).toBe(true)
})

it('lists history metadata deterministically and reports snapshots that are unavailable', async () => {
  const history = createHttpHistoryStorage()
  const first = history.appendEntry({
    requestId: 1,
    method: 'GET',
    url: 'https://example.test/1',
    status: 200,
    durationMs: 1,
    sizeBytes: 0,
    requestedAt: 100,
  })
  const second = history.appendEntry({
    requestId: 2,
    method: 'POST',
    url: 'https://example.test/2',
    status: null,
    durationMs: 1,
    sizeBytes: 0,
    requestedAt: 100,
    error: 'network error',
  })
  const listed = await call('list_http_history', { limit: 1 })
  expect(listed).toMatchObject({
    items: [{ id: second.id, hasResponse: false }],
    hasMore: true,
    nextOffset: 1,
  })
  expect(listed.items[0]).not.toHaveProperty('snapshotFile')
  expect(await call('list_http_history', { requestId: 1 })).toMatchObject({
    items: [{ id: first.id }],
    hasMore: false,
  })
  expect(await call('list_http_history', { offset: 2 })).toEqual({
    items: [],
    hasMore: false,
    nextOffset: null,
  })
  expect(
    JSON.parse(
      (await toolCall('get_http_history', { id: first.id })).content[0].text,
    ).code,
  ).toBe('HISTORY_SNAPSHOT_UNAVAILABLE')
})

it('correlates network errors with history and keeps execution errors unchanged if history saving fails', async () => {
  const request = await call('create_http_request', {
    name: 'Unavailable server',
    url: 'http://127.0.0.1:1',
  })
  const first = await toolCall('execute_http_request', { id: request.id })
  const result = JSON.parse(first.content[0].text)
  expect(result.historyId).toBeGreaterThan(0)
  expect(
    (await call('get_http_history', { id: result.historyId })).response.error,
  ).toBeTruthy()
  vi.spyOn(fs, 'writeJsonSync').mockImplementation(() => {
    throw new Error('history write failed')
  })
  const second = JSON.parse(
    (await toolCall('execute_http_request', { id: request.id })).content[0]
      .text,
  )
  expect(second.historyId).toBeNull()
  expect(second.error).toBe(result.error)
})

it('returns null historyId when history is disabled', async () => {
  historyLimit = 0
  const request = await call('create_http_request', {
    name: 'No history',
    url: 'http://127.0.0.1:1',
  })
  const response = JSON.parse(
    (await toolCall('execute_http_request', { id: request.id })).content[0]
      .text,
  )
  expect(response.historyId).toBeNull()
  expect(createHttpHistoryStorage().getEntries()).toEqual([])
})

it('returns REST content revisions and rejects stale PATCH writes with 409', async () => {
  const request = createHttpRequestsStorage().createRequest({ name: 'REST' })
  const get = () =>
    httpRequestsRoute.handle(
      new Request(`http://localhost/http-requests/${request.id}`),
    )
  const patch = (body: object) =>
    httpRequestsRoute.handle(
      new Request(`http://localhost/http-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    )
  const initial = await (await get()).json()
  expect(initial.contentRevision).toMatch(/^[a-f0-9]{64}$/)
  const success = await patch({
    expectedRevision: initial.contentRevision,
    description: 'saved',
  })
  expect(success.status).toBe(200)
  const acknowledged = await success.json()
  expect(acknowledged.contentRevision).not.toBe(initial.contentRevision)
  expect((await (await get()).json()).contentRevision).toBe(
    acknowledged.contentRevision,
  )
  expect(
    (
      await patch({
        expectedRevision: initial.contentRevision,
        description: 'stale',
      })
    ).status,
  ).toBe(409)
  expect((await (await get()).json()).description).toBe('saved')
  expect((await patch({ description: 'legacy client' })).status).toBe(200)
})

it('validates the final text body and allows reducing an oversized saved request', async () => {
  const storage = createHttpRequestsStorage()
  const request = storage.createRequest({ name: 'Large existing' })
  storage.updateRequest(request.id, {
    bodyType: 'text',
    body: 'x'.repeat(256 * 1024 + 1),
  })
  const large = storage.getRequestById(request.id)!
  await call('update_http_request', {
    id: request.id,
    expectedRevision: large.contentRevision,
    patch: { body: 'small' },
  })
  storage.updateRequest(request.id, {
    bodyType: 'binary',
    body: '/private/file',
  })
  const binary = storage.getRequestById(request.id)!
  const invalid = await toolCall('update_http_request', {
    id: request.id,
    expectedRevision: binary.contentRevision,
    patch: { body: '/another/file' },
  })
  expect(JSON.parse(invalid.content[0].text).code).toBe(
    'UNSUPPORTED_BODY_TYPE',
  )
  expect(storage.getRequestById(request.id)!.body).toBe('/private/file')
  await call('update_http_request', {
    id: request.id,
    expectedRevision: binary.contentRevision,
    patch: { bodyType: 'text', body: 'text' },
  })
  storage.updateRequest(request.id, { protocol: 'websocket' })
  const websocket = storage.getRequestById(request.id)!
  expect(
    (
      await toolCall('update_http_request', {
        id: request.id,
        expectedRevision: websocket.contentRevision,
        patch: { description: 'blocked' },
      })
    ).isError,
  ).toBe(true)
})
