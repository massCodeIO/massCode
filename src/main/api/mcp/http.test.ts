import type { HttpRequestsStorage } from '../../storage/contracts'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  beginHttpExecution,
  finishHttpExecution,
} from '../../http/runtime/session'
import { createMcpRoute } from './route'

const state = vi.hoisted(() => ({
  item: {} as NonNullable<ReturnType<HttpRequestsStorage['getRequestById']>>,
  execute: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
}))
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: state.send } }],
  },
}))
vi.mock('../../store', () => ({ store: { preferences: { get: () => true } } }))
vi.mock('../integrations/auth', () => ({
  isIntegrationTokenAuthorized: () => true,
}))
vi.mock('../../http/runtime/execute', () => ({
  executeHttpRequest: state.execute,
}))
vi.mock('../../storage', () => ({
  useHttpStorage: () => ({
    requests: {
      getRequestById: () => state.item,
      createRequest: state.create,
      updateRequest: state.update,
    },
    environments: { getActiveEnvironmentId: () => 3 },
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
