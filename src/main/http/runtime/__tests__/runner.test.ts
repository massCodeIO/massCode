import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelHttpRun,
  disposeHttpRun,
  getHttpRun,
  prepareHttpRun,
  startHttpRun,
} from '../runner'
import {
  beginHttpExecution,
  commitHttpSession,
  finishHttpExecution,
  getHttpSession,
  resetHttpSession,
} from '../session'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  history: vi.fn(),
  vault: '/vault',
  envId: 1 as number | null,
  folders: [] as any[],
  records: [] as any[],
  env: { id: 1, name: 'Local', variables: { host: 'example.test' } },
}))
vi.mock('undici', () => ({ Agent: class {}, request: mocks.request }))
vi.mock('../../secrets', () => ({ getEnvironmentSecrets: () => ({}) }))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => mocks.vault,
}))
vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    folders: { getFolders: () => mocks.folders },
    requests: {
      getRequests: () => mocks.records,
      getRequestById: (id: number) =>
        mocks.records.find(record => record.id === id),
    },
    environments: {
      getActiveEnvironmentId: () => mocks.envId,
      getEnvironments: () => [mocks.env],
    },
    history: { appendEntry: mocks.history },
  }),
}))

function record(id: number, folderId = 1) {
  return {
    id,
    folderId,
    name: `Request ${id}`,
    createdAt: id,
    isDeleted: 0,
    runtimeState: 'ready',
    runtime: { version: 1, extractions: [], assertions: [] },
    method: 'GET',
    url: 'https://{{host}}/test',
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
    formData: [],
    auth: { type: 'none' },
  }
}
function response(body = '{}', status = 200) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json' },
    body: Readable.from([body]),
  }
}
function start(
  view: ReturnType<typeof prepareHttpRun>,
  continueOnFailure = false,
) {
  return startHttpRun(7, {
    runId: view.runId,
    requestIds: view.steps.map(step => step.requestId),
    continueOnFailure,
    skipCertificateVerification: false,
  })
}

beforeEach(() => {
  disposeHttpRun(7)
  finishHttpExecution()
  resetHttpSession()
  vi.clearAllMocks()
  mocks.vault = '/vault'
  mocks.envId = 1
  mocks.env = { id: 1, name: 'Local', variables: { host: 'example.test' } }
  mocks.folders = [
    { id: 1, name: 'API', parentId: null, orderIndex: 0, createdAt: 1 },
    { id: 2, name: 'Child', parentId: 1, orderIndex: 0, createdAt: 2 },
  ]
  mocks.records = [record(1), record(2, 2)]
  mocks.request.mockImplementation(async () => response())
})

describe('folder runner', () => {
  it('excludes WebSocket requests from HTTP runs', () => {
    mocks.records = [record(1), { ...record(2), protocol: 'websocket' }]
    expect(prepareHttpRun(7, 1).steps.map(step => step.requestId)).toEqual([
      1,
    ])
    mocks.records = [{ ...record(2), protocol: 'websocket' }]
    expect(() => prepareHttpRun(7, 1)).toThrow('HTTP_RUN_EMPTY')
  })
  it('prepares a recursive stable list, excluding trash, without network calls', () => {
    mocks.records = [
      record(3),
      { ...record(4), isDeleted: 1 },
      record(2, 2),
      record(1),
    ]
    const view = prepareHttpRun(7, 1)
    expect(view.steps.map(step => step.requestId)).toEqual([1, 3, 2])
    expect(view.steps[2]?.folderPath).toBe('API / Child')
    expect(mocks.request).not.toHaveBeenCalled()
    expect(JSON.stringify(view)).not.toContain('example.test')
  })

  it.each(['pending', 'invalid', 'unsupported'])(
    'preflights every request and blocks %s rules before sending',
    (runtimeState) => {
      mocks.records[1].runtimeState = runtimeState
      expect(() => prepareHttpRun(7, 1)).toThrow(
        'HTTP_RUN_REQUEST_UNAVAILABLE',
      )
      expect(mocks.request).not.toHaveBeenCalled()
    },
  )

  it('blocks pending bodies, empty folders and oversized runs', () => {
    mocks.records[1].pendingCloudDownload = true
    expect(() => prepareHttpRun(7, 1)).toThrow('HTTP_RUN_REQUEST_UNAVAILABLE')
    mocks.records = []
    expect(() => prepareHttpRun(7, 1)).toThrow('HTTP_RUN_EMPTY')
    mocks.records = Array.from({ length: 501 }, (_, i) => record(i + 1))
    expect(() => prepareHttpRun(7, 1)).toThrow('HTTP_RUN_TOO_LARGE')
  })

  it('uses immutable request and environment snapshots with isolated run variables', async () => {
    mocks.records[0].runtime.extractions.push({
      name: 'token',
      source: 'json',
      path: '/token',
    })
    mocks.records[1].headers = [{ key: 'Authorization', value: '{{token}}' }]
    const manual = getHttpSession('/vault', 1)
    commitHttpSession(manual.generation, new Map([['manualOnly', 'private']]))
    const view = prepareHttpRun(7, 1)
    mocks.env.variables.host = 'changed.test'
    mocks.records[1].url = 'https://changed.test'
    mocks.request.mockImplementationOnce(async () =>
      response('{"token":"run-secret"}'),
    )
    const result = await start(view)
    expect(mocks.request.mock.calls[1][0]).toBe('https://example.test/test')
    expect(mocks.request.mock.calls[1][1].headers.Authorization).toBe(
      'run-secret',
    )
    expect(getHttpSession('/vault', 1).variables).toEqual({
      manualOnly: 'private',
    })
    expect(JSON.stringify(result)).not.toContain('run-secret')
    expect(mocks.history).not.toHaveBeenCalled()
    expect(result.state).toBe('passed')
    expect(result.steps.map(step => step.state)).toEqual([
      'passed',
      'passed',
    ])
  })

  it.each([false, true])(
    'handles failures with continueOnFailure=%s',
    async (continueOnFailure) => {
      mocks.records[0].runtime.assertions.push({
        name: 'Created',
        source: 'status',
        operator: 'eq',
        expected: 201,
      })
      const result = await start(prepareHttpRun(7, 1), continueOnFailure)
      expect(result.state).toBe('failed')
      expect(result.steps.map(step => step.state)).toEqual([
        'failed',
        continueOnFailure ? 'passed' : 'skipped',
      ])
      expect(mocks.request).toHaveBeenCalledTimes(continueOnFailure ? 2 : 1)
    },
  )

  it('honors the displayed custom order and rejects duplicate or foreign IDs', async () => {
    const view = prepareHttpRun(7, 1)
    const options = {
      runId: view.runId,
      requestIds: [1, 1],
      continueOnFailure: false,
      skipCertificateVerification: false,
    }
    await expect(startHttpRun(7, options)).rejects.toThrow(
      'HTTP_RUN_INVALID_ORDER',
    )
    await expect(
      startHttpRun(8, { ...options, requestIds: [2, 1] }),
    ).rejects.toThrow('HTTP_RUN_NOT_FOUND')
    const result = await startHttpRun(7, { ...options, requestIds: [2, 1] })
    expect(result.steps.map(step => step.requestId)).toEqual([2, 1])
  })

  it.each(['http', 'network', 'extraction'])(
    'stops on a %s failure without requiring assertions',
    async (failure) => {
      if (failure === 'http')
        mocks.request.mockImplementationOnce(async () => response('{}', 500))
      if (failure === 'network')
        mocks.request.mockRejectedValueOnce(new Error('Connection refused'))
      if (failure === 'extraction') {
        mocks.records[0].runtime.extractions.push({
          name: 'missing',
          source: 'json',
          path: '/missing',
        })
      }
      const result = await start(prepareHttpRun(7, 1))
      expect(result.state).toBe('failed')
      expect(result.steps.map(step => step.state)).toEqual([
        'failed',
        'skipped',
      ])
      expect(mocks.request).toHaveBeenCalledTimes(1)
      expect(mocks.history).not.toHaveBeenCalled()
    },
  )

  it('starts every new run with empty variables', async () => {
    mocks.records[0].runtime.extractions.push({
      name: 'token',
      source: 'json',
      path: '/token',
    })
    mocks.request.mockImplementationOnce(async () =>
      response('{"token":"previous-run"}'),
    )
    await start(prepareHttpRun(7, 1))
    mocks.records[0].runtime.extractions = []
    mocks.records[0].headers = [{ key: 'X-Token', value: '{{token}}' }]
    await start(prepareHttpRun(7, 1))
    expect(mocks.request.mock.calls[2][1].headers['X-Token']).not.toBe(
      'previous-run',
    )
  })

  it('cancels the active network request and skips remaining steps', async () => {
    mocks.request.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    const view = prepareHttpRun(7, 1)
    const pending = start(view)
    expect(getHttpRun(7, view.runId).steps[0]?.state).toBe('running')
    expect(beginHttpExecution()).toBe(false)
    cancelHttpRun(7, view.runId)
    const result = await pending
    expect(result.state).toBe('cancelled')
    expect(result.steps.map(step => step.state)).toEqual([
      'cancelled',
      'skipped',
    ])
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(beginHttpExecution()).toBe(true)
  })

  it('cancels when the owner closes the runner', async () => {
    mocks.request.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    const view = prepareHttpRun(7, 1)
    const pending = start(view)
    disposeHttpRun(7)
    expect((await pending).state).toBe('cancelled')
    expect(() => getHttpRun(7, view.runId)).toThrow('HTTP_RUN_NOT_FOUND')
  })

  it('rejects changed context before start and discards it during a run', async () => {
    const view = prepareHttpRun(7, 1)
    mocks.envId = null
    await expect(start(view)).rejects.toThrow('HTTP_CONTEXT_CHANGED')
    expect(mocks.request).not.toHaveBeenCalled()
    mocks.envId = 1
    mocks.request.mockImplementationOnce(async () => {
      mocks.vault = '/other'
      return response()
    })
    const result = await start(view)
    expect(result.state).toBe('cancelled')
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(mocks.history).not.toHaveBeenCalled()
  })
})
