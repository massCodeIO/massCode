import type { HttpExecutePayload } from '../../../types/http'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHttpSession } from '../../../http/runtime/session'
import { registerHttpHandlers } from '../http'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  request: vi.fn(),
  history: vi.fn(),
  vault: '/vault',
  activeEnvironment: null as number | null,
  runtimeState: 'ready',
}))
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle } }))
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
  it('extracts login token and uses it in the next request, masking history', async () => {
    const execute = getHandler()
    mocks.request.mockResolvedValueOnce(response('{"token":"secret token"}'))
    const first = await execute(null, payload)
    expect(first.sessionNames).toEqual(['token'])
    expect(first.runtimeResults.assertions[0].ok).toBe(true)
    mocks.request.mockResolvedValueOnce(response('{}'))
    const second = await execute(null, {
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
  it.each(['invalid-url', 'missing-file'])(
    'clears previous extracted values on %s preparation failure and releases execution',
    async (failure) => {
      const execute = getHandler()
      mocks.request.mockResolvedValueOnce(
        response('{"token":"sensitive-token"}'),
      )
      await execute(null, payload)
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
      const failed = await execute(null, {
        ...payload,
        request: failedRequest,
      })
      expect(failed.sessionNames).toEqual([])
      expect(failed.runtimeResults.extractions[0].ok).toBe(false)
      expect(failed.error).not.toContain('sensitive-token')
      expect(mocks.request).toHaveBeenCalledTimes(1)
      mocks.request.mockResolvedValueOnce(response('{}'))
      await execute(null, payload)
      expect(mocks.request).toHaveBeenCalledTimes(2)
    },
  )
  it.each(['pending', 'invalid', 'unsupported'])(
    'fails closed when runtime is %s',
    async (state) => {
      mocks.runtimeState = state
      await expect(getHandler()(null, payload)).rejects.toThrow(
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
    const pending = execute(null, payload)
    await expect(execute(null, payload)).rejects.toThrow(
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
    const pending = getHandler()(null, payload)
    mocks.vault = '/other-vault'
    resolve(response('{"token":"stale"}'))
    expect((await pending).discarded).toBe(true)
    expect(mocks.history).not.toHaveBeenCalled()
  })
})
