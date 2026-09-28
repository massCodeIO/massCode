import type { HttpRequestsStorage } from '../../storage/contracts'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  beginHttpExecution,
  commitHttpSession,
  finishHttpExecution,
  getHttpSession,
  resetHttpSession,
} from '../../http/runtime/session'
import { createMcpRoute } from './route'

const state = vi.hoisted(() => ({
  item: {} as NonNullable<ReturnType<HttpRequestsStorage['getRequestById']>>,
  execute: vi.fn(),
  create: vi.fn(),
  createFolder: vi.fn(),
  getFoldersTree: vi.fn(),
  getRequests: vi.fn(),
  getFolders: vi.fn(() => []),
  getEnvironments: vi.fn(() => []),
  getSnapshot: vi.fn(),
  trusted: vi.fn(() => true),
  update: vi.fn(),
  send: vi.fn(),
}))
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: state.send } }],
  },
}))
vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: (key: string) => (key === 'storage.vaultPath' ? '/vault' : true),
    },
  },
}))
vi.mock('../../http/scripts/trust', () => ({ scriptsTrusted: state.trusted }))
vi.mock('../integrations/auth', () => ({
  isIntegrationTokenAuthorized: () => true,
}))
vi.mock('../../http/runtime/execute', () => ({
  executeHttpRequest: state.execute,
}))
vi.mock('../../storage', () => ({
  useHttpStorage: () => ({
    folders: {
      createFolder: state.createFolder,
      getFolders: state.getFolders,
      getFoldersTree: state.getFoldersTree,
    },
    requests: {
      getRequestById: () => state.item,
      getRequests: state.getRequests,
      createRequest: state.create,
      updateRequest: state.update,
    },
    environments: {
      getActiveEnvironmentId: () => 3,
      getEnvironments: state.getEnvironments,
    },
    history: { getSnapshot: state.getSnapshot },
  }),
}))

async function call(
  name = 'execute_http_request',
  args = { id: 1 } as Record<string, unknown>,
) {
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
  const text = await response.text()
  const payload = JSON.parse(
    text.startsWith('event:') ? text.split('data: ')[1].trim() : text,
  )
  return {
    ...payload.result,
    data: JSON.parse(payload.result.content[0].text),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  finishHttpExecution()
  resetHttpSession()
  state.item = {
    id: 1,
    name: 'Test',
    url: 'https://example.test',
    method: 'GET',
    body: null,
    description: '',
    bodyType: 'none',
    headers: [],
    query: [],
    formData: [],
    auth: { type: 'none' },
    folderId: null,
    filePath: 'Test.md',
    isDeleted: 0,
    isFavorites: 0,
    createdAt: 1,
    updatedAt: 1,
    contentRevision: 'baseline',
    runtimeState: 'ready',
    runtime: null,
    runtimeRevision: null,
  }
  state.execute.mockResolvedValue({
    status: 200,
    body: 'ok',
    headers: [],
    truncated: false,
  })
})

it('executes with the active environment and bounds saved transport overrides', async () => {
  state.item.runtime = {
    version: 2,
    assertions: [],
    extractions: [],
    transport: { timeoutMs: 0, maxResponseBytes: 0, followRedirects: false },
  }
  expect((await call()).data).toMatchObject({ id: 1, status: 200, body: 'ok' })
  expect(state.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      requestId: 1,
      environmentId: 3,
      runtime: expect.objectContaining({
        transport: {
          timeoutMs: 30_000,
          maxResponseBytes: 256 * 1024,
          followRedirects: false,
        },
      }),
    }),
    undefined,
    expect.any(AbortSignal),
  )
  expect(beginHttpExecution()).toBe(true)
  finishHttpExecution()
})

it.each([
  { isDeleted: 1 },
  { protocol: 'websocket' },
  { pendingCloudDownload: true },
  { runtimeState: 'invalid' },
  { bodyType: 'binary', body: '/private/file' },
  {
    bodyType: 'multipart',
    formData: [{ key: 'f', type: 'file', value: '/private/file' }],
  },
])('rejects unavailable or unsupported saved requests: %j', async (patch) => {
  Object.assign(state.item, patch)
  expect((await call()).isError).toBe(true)
  expect(state.execute).not.toHaveBeenCalled()
})

it('does not interfere with another execution lock', async () => {
  expect(beginHttpExecution()).toBe(true)
  expect((await call()).data.code).toBe('HTTP_REQUEST_RUNNING')
  expect(beginHttpExecution()).toBe(false)
  expect(state.execute).not.toHaveBeenCalled()
  finishHttpExecution()
})

it('releases the lock after failure without exposing internal errors', async () => {
  state.execute.mockRejectedValue(new Error('private details'))
  const response = await call()
  expect(response.isError).toBe(true)
  expect(JSON.stringify(response)).not.toContain('private details')
  expect(beginHttpExecution()).toBe(true)
  finishHttpExecution()
})

it('marks uncertain execution outcomes as errors without retrying', async () => {
  state.execute.mockResolvedValue({ status: null, discarded: true, body: '' })
  expect((await call()).isError).toBe(true)
  expect(state.execute).toHaveBeenCalledTimes(1)
})

it('reports a persisted request when the content save fails', async () => {
  state.create.mockReturnValue({ id: 12 })
  state.update.mockImplementation(() => {
    throw new Error('private details')
  })
  const response = await call('create_http_request', {
    name: 'New',
    url: 'https://example.test',
  })
  expect(response.data).toMatchObject({
    code: 'PARTIAL_CREATE',
    id: 12,
    retryable: false,
  })
  expect(state.send).toHaveBeenCalledWith('system:storage-synced')
})

it('creates a root HTTP collection and refreshes the app', async () => {
  state.createFolder.mockReturnValue({ id: 42 })
  const response = await call('create_http_collection', { name: ' API ' })
  expect(response.data).toEqual({ type: 'http_collection', id: 42 })
  expect(state.createFolder).toHaveBeenCalledWith({
    name: 'API',
    parentId: null,
  })
  expect(state.send).toHaveBeenCalledWith('system:storage-synced')
})

it('rejects invalid collection names before writing', async () => {
  expect(
    (await call('create_http_collection', { name: '../API' })).data.code,
  ).toBe('INVALID_NAME')
  expect(state.createFolder).not.toHaveBeenCalled()
  expect(state.send).not.toHaveBeenCalled()
})

it('reports collection name conflicts without exposing storage details', async () => {
  state.createFolder.mockImplementation(() => {
    throw new Error('NAME_CONFLICT: private path')
  })
  const response = await call('create_http_collection', { name: 'API' })
  expect(response.data.code).toBe('NAME_CONFLICT')
  expect(JSON.stringify(response)).not.toContain('private path')
  expect(state.send).not.toHaveBeenCalled()
})

it.each([undefined, null, 42])(
  'saves requests in the selected folder or without a collection: %s',
  async (folderId) => {
    state.create.mockReturnValue({ id: 12 })
    state.update.mockReturnValue({ invalidInput: false, notFound: false })
    const response = await call('create_http_request', {
      name: 'New',
      url: 'https://example.test',
      ...(folderId === undefined ? {} : { folderId }),
    })
    expect(response.data).toEqual({ type: 'http_request', id: 12 })
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: folderId ?? null }),
    )
  },
)

it('reports missing request folders without saving request content', async () => {
  state.create.mockImplementation(() => {
    throw new Error('FOLDER_NOT_FOUND: Folder not found')
  })
  const response = await call('create_http_request', {
    name: 'New',
    url: 'https://example.test',
    folderId: 42,
  })
  expect(response.data.code).toBe('NOT_FOUND')
  expect(state.update).not.toHaveBeenCalled()
  expect(state.send).not.toHaveBeenCalled()
})

it('lists only collection and nested folder identities, without configuration or requests', async () => {
  state.getFoldersTree.mockReturnValue([
    {
      id: 1,
      name: 'API',
      parentId: null,
      collectionConfig: { auth: { token: 'private-root-token' } },
      requests: [{ id: 5, url: 'private-url' }],
      children: [
        {
          id: 2,
          name: 'Users',
          parentId: 1,
          collectionConfig: { headers: [{ value: 'private-child-secret' }] },
          children: [],
        },
      ],
    },
  ])
  expect((await call('list_http_collections', {})).data).toEqual([
    {
      id: 1,
      name: 'API',
      parentId: null,
      children: [{ id: 2, name: 'Users', parentId: 1, children: [] }],
    },
  ])
  expect(state.send).not.toHaveBeenCalled()
})

it('maps collection listing failures without exposing storage details', async () => {
  state.getFoldersTree.mockImplementation(() => {
    throw new Error('VAULT_HYDRATING: private path')
  })
  const response = await call('list_http_collections', {})
  expect(response.data).toMatchObject({
    code: 'VAULT_HYDRATING',
    retryable: true,
  })
  expect(JSON.stringify(response)).not.toContain('private path')
})

it('defaults HTTP listing to 20 metadata results and bounds oversized pages', async () => {
  state.getRequests.mockReturnValue(
    Array.from({ length: 21 }, (_, index) => ({
      ...state.item,
      id: index + 1,
    })),
  )
  const page = await call('list_http_requests', {})
  expect(page.data.items).toHaveLength(20)
  expect(page.data).toMatchObject({ hasMore: true, nextOffset: 20 })
  state.getRequests.mockReturnValue([
    { ...state.item, name: 'x'.repeat(2 * 1024 * 1024) },
  ])
  const oversized = await call('list_http_requests', {})
  expect(oversized.data.code).toBe('CONTENT_TOO_LARGE')
  expect(state.send).not.toHaveBeenCalled()
})

it('previews masked environment/session values and script trust without mutation or execution', async () => {
  state.item.url = 'https://example.test/{{secret}}/{{sessionValue}}'
  state.item.body = 'private body'
  state.item.auth = { type: 'bearer', token: 'private auth' }
  state.item.runtime = {
    version: 2,
    assertions: [],
    extractions: [],
    scripts: { preRequest: 'private script', postResponse: '' },
    transport: { timeoutMs: 100000, maxResponseBytes: 999999 },
  }
  state.getEnvironments.mockReturnValue([
    {
      id: 3,
      name: 'Test',
      variables: { secret: 'private-secret' },
      secretKeys: ['secret'],
    },
  ] as never)
  const session = getHttpSession('/vault', 3)
  commitHttpSession(
    session.generation,
    new Map([['sessionValue', 'private-session']]),
  )
  const before = getHttpSession('/vault', 3)
  const saved = JSON.stringify(state.item)
  const preview = await call('preview_http_request', { id: 1 })
  expect(preview.isError).not.toBe(true)
  expect(preview.data).toMatchObject({
    contentRevision: 'baseline',
    environmentId: 3,
    environmentName: 'Test',
    authType: 'bearer',
    transport: { timeoutMs: 60000, maxResponseBytes: 256 * 1024 },
    scripts: [
      {
        source: 'request',
        id: 1,
        preRequest: true,
        postResponse: false,
        trusted: true,
      },
    ],
  })
  expect(JSON.stringify(preview)).not.toContain('private')
  expect(state.trusted).toHaveBeenCalledWith(
    1,
    state.item.runtime.scripts,
    'request',
    true,
  )
  expect(getHttpSession('/vault', 3)).toEqual(before)
  expect(JSON.stringify(state.item)).toBe(saved)
  expect(state.execute).not.toHaveBeenCalled()
  expect(state.send).not.toHaveBeenCalled()
})

it('caps saved history snapshots instead of returning oversized content', async () => {
  state.getSnapshot.mockReturnValue({
    response: { body: 'x'.repeat(2 * 1024 * 1024) },
  })
  expect((await call('get_http_history', { id: 1 })).data.code).toBe(
    'CONTENT_TOO_LARGE',
  )
})
