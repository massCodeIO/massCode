import type { HttpRuntime } from '../../../../shared/httpRuntime'
import type { HttpExecutePayload } from '../../../types/http'
import type { HttpImportRequest } from '../types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeHttpRequest } from '../../runtime/execute'
import { getHttpSession, resetHttpSession } from '../../runtime/session'
import { scriptsTrusted, setScriptTrust } from '../../scripts/trust'
import { previewHttpImport } from '../index'
import { parseOpenCollectionFiles } from '../opencollection'
import { persistHttpImportResult } from '../persist'
import { parsePostmanFiles } from '../postman'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  history: vi.fn(),
  grants: {},
  records: new Map<
    number,
    {
      id: number
      createdAt: number
      runtimeState: string
      runtimeRevision: string
      runtime?: HttpRuntime
    }
  >(),
}))
vi.mock('electron-store', () => ({
  default: class {
    get() {
      return structuredClone(mocks.grants)
    }

    set(_key: string, value: unknown) {
      mocks.grants = structuredClone(value as object)
    }
  },
}))
vi.mock('undici', () => ({ Agent: class {}, request: mocks.request }))
vi.mock('../../secrets', () => ({ getEnvironmentSecrets: () => ({}) }))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => '/import-test-vault',
}))
vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    folders: { createFolder: () => ({ id: 1 }) },
    requests: {
      createRequest: () => {
        const id = mocks.records.size + 1
        mocks.records.set(id, {
          id,
          createdAt: id * 10,
          runtimeState: 'ready',
          runtimeRevision: 'missing',
        })
        return { id }
      },
      getRequestById: (id: number) => mocks.records.get(id),
      updateRequest: () => ({}),
      updateRuntime: (id: number, runtime: HttpRuntime, revision: string) => {
        const record = mocks.records.get(id)!
        if (record.runtimeRevision !== revision)
          throw new Error('conflict')
        record.runtime = structuredClone(runtime)
        record.runtimeRevision = `saved-${id}`
        return { notFound: false }
      },
    },
    environments: {
      getActiveEnvironmentId: () => null,
      getEnvironments: () => [],
    },
    history: { appendEntry: mocks.history },
  }),
}))
function fixture(name: string) {
  return {
    name,
    content: readFileSync(join(__dirname, 'fixtures', name), 'utf8'),
  }
}
function payload(
  request: HttpImportRequest,
  requestId: number,
): HttpExecutePayload {
  return { requestId, environmentId: null, request, runtime: request.runtime }
}
beforeEach(() => {
  resetHttpSession()
  vi.clearAllMocks()
  mocks.grants = {}
  mocks.records.clear()
  mocks.request.mockImplementation(async () => ({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: Readable.from([
      '{"token":"demo-token","received":"collection/folder/request"}',
    ]),
  }))
})

describe('preview, persistence and imported script trust', () => {
  it('previews compatibility without writing storage or executing code', async () => {
    const preview = await previewHttpImport([fixture('bruno-scripts.yml')])
    expect(preview.collections[0].runtime).toEqual([
      { name: '01 Passing tests', assertions: 3, scripts: 'converted' },
      { name: '02 Failing tests', assertions: 1, scripts: 'converted' },
      { name: '03 Unsupported script', assertions: 0, scripts: 'blocked' },
      { name: '04 Malformed script', assertions: 0, scripts: 'blocked' },
    ])
    expect(mocks.records.size).toBe(0)
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.grants).toEqual({})
  })

  it.each(['postman', 'bruno'])(
    'persists %s runtime exactly, blocks before trust, and runs after explicit local trust',
    async (dialect) => {
      const result
        = dialect === 'postman'
          ? parsePostmanFiles([fixture('postman-scripts.json')])
          : parseOpenCollectionFiles([fixture('bruno-scripts.yml')])
      persistHttpImportResult(result)
      const request = result.collections[0].requests[0]
      expect(mocks.records.get(1)?.runtime).toEqual(request.runtime)
      expect(scriptsTrusted(1, request.runtime?.scripts)).toBe(false)
      const denied = await executeHttpRequest(payload(request, 1))
      expect(denied.scriptResults).toContainEqual(
        expect.objectContaining({ error: 'untrusted' }),
      )
      expect(mocks.request).not.toHaveBeenCalled()
      expect(
        Object.keys(getHttpSession('/import-test-vault', null).variables),
      ).toHaveLength(0)

      setScriptTrust(1, request.runtime!.scripts!, true)
      const passed = await executeHttpRequest(payload(request, 1))
      expect(passed.status).toBe(200)
      expect(
        passed.scriptResults
          ?.flatMap(phase => phase.tests)
          .every(test => test.ok),
      ).toBe(true)
      expect(passed.scriptResults?.some(phase => phase.error)).toBe(false)
      expect(passed.runtimeResults?.assertions.every(rule => rule.ok)).toBe(
        true,
      )
      expect(getHttpSession('/import-test-vault', null).variables.token).toBe(
        'demo-token',
      )

      const failing = result.collections[0].requests[1]
      setScriptTrust(2, failing.runtime!.scripts!, true)
      const failed = await executeHttpRequest(payload(failing, 2))
      expect(
        failed.scriptResults?.flatMap(phase => phase.tests),
      ).toContainEqual({ name: 'Intentional failure', ok: false })
      if (dialect === 'bruno') {
        expect(failed.runtimeResults?.assertions.some(rule => !rule.ok)).toBe(
          true,
        )
      }

      persistHttpImportResult(result)
      expect(scriptsTrusted(5, request.runtime!.scripts!)).toBe(false)
    },
  )

  it('does not run any part of a blocked script set even after trust', async () => {
    const result = parsePostmanFiles([fixture('postman-scripts.json')])
    persistHttpImportResult(result)
    const request = result.collections[0].requests[2]
    setScriptTrust(3, request.runtime!.scripts!, true)
    const denied = await executeHttpRequest(payload(request, 3))
    expect(denied.scriptResults).toContainEqual(
      expect.objectContaining({ error: 'exception' }),
    )
    expect(mocks.request).not.toHaveBeenCalled()
  })
})
