import type { HttpExecutePayload } from '../../../types/http'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHttpSession } from '../../../http/runtime/session'
import { registerHttpHandlers } from '../http'

const event = { sender: Object.assign(new EventEmitter(), { id: 1 }) }

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  request: vi.fn(),
  history: vi.fn(),
  vault: '/vault',
  activeEnvironment: null as number | null,
  runtimeState: 'ready',
}))
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle } }))
vi.mock('../../../http/cookies/store', () => ({
  getHttpCookieJar: () => ({ enabled: () => false }),
}))
vi.mock('undici', () => ({ Agent: class {}, request: mocks.request }))
vi.mock('../../../http/secrets', () => ({ getEnvironmentSecrets: () => ({}) }))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => mocks.vault,
}))
vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    requests: {
      getRequestById: () => ({
        runtimeState: mocks.runtimeState,
        runtime: {
          version: 1,
          extractions: [{ name: 'token', source: 'json', path: '/token' }],
          assertions: [
            { name: 'status', source: 'status', operator: 'eq', expected: 200 },
          ],
        },
      }),
    },
    environments: {
      getActiveEnvironmentId: () => mocks.activeEnvironment,
      getEnvironments: () => [],
    },
    history: { appendEntry: mocks.history },
  }),
}))

const payload: HttpExecutePayload = {
  requestId: 1,
  environmentId: null,
  request: {
    method: 'GET',
    url: 'https://example.test',
    headers: [],
    query: [],
    auth: { type: 'none' },
    body: null,
    bodyType: 'none',
    formData: [],
  },
}
function getHandler(channel = 'spaces:http:execute') {
  registerHttpHandlers()
  return mocks.handle.mock.calls.find(([name]) => name === channel)![1]
}
function response(body: string) {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: Readable.from([body]),
  }
}

describe('hTTP runtime execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHttpSession()
    mocks.vault = '/vault'
    mocks.runtimeState = 'ready'
    mocks.activeEnvironment = null
  })
  it('applies request overrides over caller defaults and supports unlimited response bodies', async () => {
    mocks.request.mockResolvedValue(response('123456789'))
    const result = await getHandler()(event, {
      ...payload,
      transport: {
        timeoutMs: 1,
        maxResponseBytes: 2,
        followRedirects: false,
        maxRedirects: 1,
      },
      runtime: {
        version: 1,
        extractions: [],
        assertions: [],
        transport: {
          timeoutMs: 0,
          maxResponseBytes: 0,
          followRedirects: true,
          maxRedirects: 3,
        },
      },
    })
    expect(result.body).toBe('123456789')
    expect(result.truncated).toBe(false)
    expect(mocks.request.mock.calls[0][1]).toMatchObject({
      headersTimeout: 0,
      bodyTimeout: 0,
      maxRedirections: 3,
    })
  })
  it('truncates the body at the configured byte limit', async () => {
    mocks.request.mockResolvedValue(response('123456789'))
    const result = await getHandler()(event, {
      ...payload,
      transport: { maxResponseBytes: 4 },
    })
    expect(result).toMatchObject({
      body: '1234',
      sizeBytes: 4,
      truncated: true,
    })
  })
  it('allows explicit redirects for GraphQL', async () => {
    mocks.request.mockResolvedValue(response('{"data":{}}'))
    await getHandler()(event, {
      ...payload,
      transport: { followRedirects: true, maxRedirects: 2 },
      request: {
        ...payload.request,
        method: 'POST',
        bodyType: 'graphql',
        body: '{"query":"{ ok }","variables":"{}","operationName":""}',
      },
    })
    expect(mocks.request.mock.calls[0][1].maxRedirections).toBe(2)
  })

  it('executes GraphQL via the shared transport, auth, extraction and assertions', async () => {
    mocks.request.mockResolvedValue(
      response('{"data":{"token":"demo"},"errors":[{"message":"partial"}]}'),
    )
    const result = await getHandler()(event, {
      ...payload,
      runtime: {
        version: 1,
        extractions: [{ name: 'token', source: 'json', path: '/data/token' }],
        assertions: [
          {
            name: 'HTTP status',
            source: 'status',
            operator: 'eq',
            expected: 200,
          },
        ],
      },
      request: {
        ...payload.request,
        method: 'POST',
        bodyType: 'graphql',
        auth: { type: 'bearer', token: 'demo' },
        body: JSON.stringify({
          query: '{ token }',
          variables: '{}',
          operationName: '',
        }),
      },
    })
    expect(result.graphql).toBe('errors')
    expect(result.status).toBe(200)
    expect(result.body).toContain('partial')
    expect(result.runtimeResults.assertions[0].ok).toBe(true)
    expect(result.sessionNames).toContain('token')
    expect(mocks.request.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      maxRedirections: 0,
      headers: {
        'Authorization': 'Bearer demo',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toEqual({
      query: '{ token }',
      variables: {},
    })
  })

  it.each(['{bad', 'null'])(
    'does not send invalid GraphQL variables %s',
    async (variables) => {
      const result = await getHandler()(event, {
        ...payload,
        request: {
          ...payload.request,
          method: 'POST',
          bodyType: 'graphql',
          body: JSON.stringify({
            query: '{ token }',
            variables,
            operationName: '',
          }),
        },
      })
      expect(result.error).toBe('GRAPHQL_VARIABLES')
      expect(mocks.request).not.toHaveBeenCalled()
    },
  )

  it('extracts login token and uses it in the next request, masking history', async () => {
    const execute = getHandler()
    mocks.request.mockResolvedValueOnce(response('{"token":"secret token"}'))
    const first = await execute(event, payload)
    expect(first.sessionNames).toEqual(['token'])
    expect(first.runtimeResults.assertions[0].ok).toBe(true)
    mocks.request.mockResolvedValueOnce(response('{}'))
    const second = await execute(event, {
      ...payload,
      request: {
        ...payload.request,
        query: [{ key: 'token', value: '{{token}}' }],
      },
    })
    expect(mocks.request.mock.calls[1][0]).toContain('token=secret+token')
    expect(JSON.stringify(mocks.history.mock.calls)).not.toContain('secret')
    expect(second.sessionNames).toEqual([])
  })
  it('executes draft assertions and extractions without replacing saved rules', async () => {
    const execute = getHandler()
    mocks.request.mockResolvedValueOnce(response('{"value":"draft-value"}'))
    const result = await execute(event, {
      ...payload,
      runtime: {
        version: 1,
        extractions: [{ name: 'draft', source: 'json', path: '/value' }],
        assertions: [
          {
            name: 'Draft status',
            source: 'status',
            operator: 'eq',
            expected: 201,
          },
        ],
      },
    })
    expect(result.runtimeResults.assertions).toMatchObject([
      { name: 'Draft status', ok: false },
    ])
    expect(result.sessionNames).toEqual(['draft'])
    mocks.request.mockResolvedValueOnce(response('{"token":"saved-value"}'))
    const savedResult = await execute(event, payload)
    expect(savedResult.runtimeResults.assertions).toMatchObject([
      { name: 'status', ok: true },
    ])
    expect(savedResult.runtimeResults.extractions).toMatchObject([
      { name: 'token', ok: true },
    ])
  })

  it('honors an empty draft instead of running saved rules', async () => {
    mocks.request.mockResolvedValueOnce(response('{}'))
    const result = await getHandler()(event, {
      ...payload,
      runtime: { version: 1, extractions: [], assertions: [] },
    })
    expect(result.runtimeResults).toEqual({ extractions: [], assertions: [] })
  })

  it('rejects invalid draft rules before network or history effects', async () => {
    await expect(
      getHandler()(event, {
        ...payload,
        runtime: {
          version: 1,
          extractions: [{ name: '', source: 'json', path: '' }],
          assertions: [],
        },
      }),
    ).rejects.toThrow()
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.history).not.toHaveBeenCalled()
  })
  it.each(['invalid-url', 'missing-file'])(
    'clears previous extracted values on %s preparation failure and releases execution',
    async (failure) => {
      const execute = getHandler()
      mocks.request.mockResolvedValueOnce(
        response('{"token":"sensitive-token"}'),
      )
      await execute(event, payload)
      const failedRequest
        = failure === 'invalid-url'
          ? { ...payload.request, url: 'not a URL' }
          : {
              ...payload.request,
              bodyType: 'multipart',
              formData: [
                {
                  key: 'file',
                  type: 'file',
                  value: '/nonexistent-http-runtime-test-file',
                },
              ],
            }
      const failed = await execute(event, {
        ...payload,
        request: failedRequest,
      })
      expect(failed.sessionNames).toEqual([])
      expect(failed.runtimeResults.extractions[0].ok).toBe(false)
      expect(failed.error).not.toContain('sensitive-token')
      expect(mocks.request).toHaveBeenCalledTimes(1)
      mocks.request.mockResolvedValueOnce(response('{}'))
      await execute(event, payload)
      expect(mocks.request).toHaveBeenCalledTimes(2)
    },
  )
  it.each(['pending', 'invalid', 'unsupported'])(
    'fails closed when runtime is %s',
    async (state) => {
      mocks.runtimeState = state
      await expect(getHandler()(event, payload)).rejects.toThrow(
        'HTTP_RUNTIME_UNAVAILABLE',
      )
      expect(mocks.request).not.toHaveBeenCalled()
    },
  )
  it('does not commit a response or history after session clear', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void
    mocks.request.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const execute = getHandler()
    const pending = execute(event, payload)
    await expect(execute(event, payload)).rejects.toThrow(
      'HTTP_REQUEST_RUNNING',
    )
    getHandler('spaces:http:clear-session')()
    resolve(response('{"token":"stale"}'))
    expect((await pending).discarded).toBe(true)
    expect(mocks.history).not.toHaveBeenCalled()
    expect(getHandler('spaces:http:session-names')()).toEqual([])
  })
  it('does not append history to a changed vault', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void
    mocks.request.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const pending = getHandler()(event, payload)
    mocks.vault = '/other-vault'
    resolve(response('{"token":"stale"}'))
    expect((await pending).discarded).toBe(true)
    expect(mocks.history).not.toHaveBeenCalled()
  })
})
