import type { HttpExecutePayload } from '../../../types/http'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyHttpCollection } from '../../../../shared/httpCollection'
import { executeHttpRequest } from '../../runtime/execute'
import {
  commitHttpSession,
  getHttpSession,
  resetHttpSession,
} from '../../runtime/session'
import { scriptsTrusted, setScriptTrust } from '../trust'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  history: vi.fn(),
  vault: '/vault',
  grants: {},
  folders: [] as any[],
  saved: {
    id: 1,
    folderId: null as number | null,
    createdAt: 10,
    runtimeState: 'ready',
    runtime: { scripts: { preRequest: '', postResponse: '' } },
  },
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
  getVaultPath: () => mocks.vault,
}))
vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    folders: { getFolders: () => mocks.folders },
    requests: { getRequestById: () => mocks.saved },
    environments: {
      getActiveEnvironmentId: () => null,
      getEnvironments: () => [],
    },
    history: { appendEntry: mocks.history },
  }),
}))

function payload(preRequest = '', postResponse = ''): HttpExecutePayload {
  return {
    requestId: 1,
    environmentId: null,
    request: {
      method: 'POST',
      url: 'https://example.test/{{path}}',
      bodyType: 'text',
      body: '{{value}}',
      auth: { type: 'none' },
      headers: [],
      query: [],
      formData: [],
    },
    runtime: {
      version: 2,
      assertions: [],
      extractions: [{ name: 'extracted', source: 'json', path: '/token' }],
      scripts: { preRequest, postResponse },
    },
  }
}
function allow(p: HttpExecutePayload) {
  setScriptTrust(1, p.runtime!.scripts!, true)
}
function session() {
  return getHttpSession('/vault', null).variables
}

beforeEach(() => {
  resetHttpSession()
  vi.clearAllMocks()
  mocks.grants = {}
  mocks.folders = []
  mocks.saved.folderId = null
  mocks.vault = '/vault'
  mocks.saved.runtime.scripts = { preRequest: '', postResponse: '' }
  mocks.request.mockImplementation(async () => ({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: Readable.from(['{"token":"response-secret"}']),
  }))
})

describe('script workflow and local trust', () => {
  it('sends effective collection headers, auth and variables while request and session values take precedence', async () => {
    const config = emptyHttpCollection()
    config.variables = [
      { key: 'path', value: 'collection' },
      { key: 'token', value: 'collection-token' },
    ]
    config.headers = [
      { key: 'X-Keep', value: 'collection' },
      { key: 'X-Mode', value: 'collection' },
    ]
    config.auth = { type: 'bearer', token: '{{token}}' }
    config.runtime.assertions = [
      {
        name: 'Collection OK',
        source: 'status',
        operator: 'eq',
        expected: 200,
      },
    ]
    mocks.folders = [
      { id: 10, parentId: null, createdAt: 100, collectionConfig: config },
    ]
    mocks.saved.folderId = 10
    commitHttpSession(
      getHttpSession('/vault', null).generation,
      new Map([['token', 'session-token']]),
    )
    const p = payload()
    p.request.auth = { type: 'inherit' }
    p.request.headers = [
      { key: 'x-mode', value: 'request' },
      { key: 'X-Keep', value: 'disabled', enabled: false },
    ]
    const result = await executeHttpRequest(p)
    expect(mocks.request.mock.calls[0][0]).toBe(
      'https://example.test/collection',
    )
    expect(mocks.request.mock.calls[0][1].headers).toMatchObject({
      'X-Keep': 'collection',
      'x-mode': 'request',
      'Authorization': 'Bearer session-token',
    })
    expect(result.runtimeResults?.assertions[0]).toMatchObject({
      name: 'Collection OK',
      source: 'collection',
      ok: true,
    })
    expect(JSON.stringify(mocks.history.mock.calls)).not.toContain(
      'session-token',
    )
  })

  it('requires collection trust independently before network, including post-only scripts', async () => {
    const config = emptyHttpCollection()
    config.runtime = {
      version: 2,
      extractions: [],
      assertions: [],
      scripts: { preRequest: '', postResponse: 'mc.assert(true)' },
    }
    mocks.folders = [
      { id: 10, parentId: null, createdAt: 100, collectionConfig: config },
    ]
    mocks.saved.folderId = 10
    const p = payload('mc.variables.set("path", "demo")')
    allow(p)
    const blocked = await executeHttpRequest(p)
    expect(blocked.error).toBe('HTTP_SCRIPT_FAILED')
    expect(blocked.scriptResults?.[0]).toMatchObject({
      source: 'collection',
      error: 'untrusted',
    })
    expect(mocks.request).not.toHaveBeenCalled()
    setScriptTrust(10, config.runtime.scripts!, true, 'collection')
    expect((await executeHttpRequest(p)).status).toBe(200)
  })

  it('runs collection pre → request pre → network → request post → collection post with isolated trust', async () => {
    const config = emptyHttpCollection()
    config.runtime = {
      version: 2,
      extractions: [],
      assertions: [],
      scripts: {
        preRequest:
          'mc.variables.set("path", "demo"); mc.variables.set("value", "Cpre")',
        postResponse:
          'mc.assert(mc.variables.get("value") === "Cpre-Rpre-Rpost"); mc.variables.set("value", mc.variables.get("value") + "-Cpost")',
      },
    }
    mocks.folders = [
      { id: 10, parentId: null, createdAt: 100, collectionConfig: config },
    ]
    mocks.saved.folderId = 10
    const p = payload(
      'mc.assert(mc.variables.get("value") === "Cpre"); mc.variables.set("value", mc.variables.get("value") + "-Rpre")',
      'mc.assert(mc.variables.get("value") === "Cpre-Rpre"); mc.variables.set("value", mc.variables.get("value") + "-Rpost")',
    )
    allow(p)
    setScriptTrust(10, config.runtime.scripts!, true, 'collection')
    const result = await executeHttpRequest(p)
    expect(mocks.request.mock.calls[0][1].body).toBe('Cpre-Rpre')
    expect(
      result.scriptResults?.map(result => [result.source, result.phase]),
    ).toEqual([
      ['collection', 'preRequest'],
      ['request', 'preRequest'],
      ['request', 'postResponse'],
      ['collection', 'postResponse'],
    ])
    expect(result.scriptResults?.some(result => result.error)).toBe(false)
    expect(session().value).toBe('Cpre-Rpre-Rpost-Cpost')
  })

  it('runs nested folder scripts in ancestry order and requires each scope to be trusted', async () => {
    const root = emptyHttpCollection()
    root.runtime.version = 2
    root.runtime.scripts = {
      preRequest:
        'mc.variables.set("path", "demo"); mc.variables.set("value", "C")',
      postResponse:
        'mc.variables.set("value", mc.variables.get("value") + "-C")',
    }
    const folder = emptyHttpCollection()
    folder.auth = { type: 'inherit' }
    folder.runtime.version = 2
    folder.runtime.scripts = {
      preRequest: 'mc.variables.set("value", mc.variables.get("value") + "-F")',
      postResponse:
        'mc.variables.set("value", mc.variables.get("value") + "-F")',
    }
    mocks.folders = [
      { id: 10, parentId: null, createdAt: 100, collectionConfig: root },
      { id: 11, parentId: 10, createdAt: 101, collectionConfig: folder },
    ]
    mocks.saved.folderId = 11
    const p = payload(
      'mc.variables.set("value", mc.variables.get("value") + "-R")',
      'mc.variables.set("value", mc.variables.get("value") + "-R")',
    )
    allow(p)
    setScriptTrust(10, root.runtime.scripts, true, 'collection')
    expect((await executeHttpRequest(p)).error).toBe('HTTP_SCRIPT_FAILED')
    expect(mocks.request).not.toHaveBeenCalled()
    setScriptTrust(11, folder.runtime.scripts, true, 'collection')
    const result = await executeHttpRequest(p)
    expect(result.status).toBe(200)
    expect(mocks.request.mock.calls[0][1].body).toBe('C-F-R')
    expect(session().value).toBe('C-F-R-R-F-C')
  })

  it('invalidates collection trust when synced code or collection identity changes', () => {
    const config = emptyHttpCollection()
    config.runtime = {
      version: 2,
      extractions: [],
      assertions: [],
      scripts: { preRequest: 'mc.assert(true)', postResponse: '' },
    }
    mocks.folders = [
      { id: 10, parentId: null, createdAt: 100, collectionConfig: config },
    ]
    const scripts = { ...config.runtime.scripts! }
    setScriptTrust(10, scripts, true, 'collection')
    expect(scriptsTrusted(10, scripts, 'collection')).toBe(true)
    config.runtime.scripts!.preRequest = 'mc.assert(false)'
    expect(scriptsTrusted(10, scripts, 'collection')).toBe(false)
    setScriptTrust(10, scripts, true, 'collection')
    mocks.folders[0].createdAt = 101
    expect(scriptsTrusted(10, scripts, 'collection')).toBe(false)
  })

  it('keeps the safe script error code when session values need masking', async () => {
    session().token = 'private-session-token'
    const p = payload('throw Error("private-session-token")')
    allow(p)
    const result = await executeHttpRequest(p)
    expect(result.error).toBe('HTTP_SCRIPT_FAILED')
    expect(result.scriptResults?.[0]?.error).toBe('exception')
    expect(JSON.stringify(result)).not.toContain('private-session-token')
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('blocks untrusted post-only scripts before any request', async () => {
    const result = await executeHttpRequest(payload('', 'mc.assert(true)'))
    expect(result.scriptResults?.[0]?.error).toBe('untrusted')
    expect(mocks.request).not.toHaveBeenCalled()
    expect(session()).toEqual({})
  })
  it('executes trusted unsaved code, pre → request → extraction → post, then commits', async () => {
    const p = payload(
      'mc.variables.set("path", "demo"); mc.variables.set("value", "pre-value")',
      'mc.test("extraction", () => mc.assert(mc.variables.get("extracted") === "response-secret")); mc.variables.set("value", "post-value")',
    )
    allow(p)
    const result = await executeHttpRequest(p)
    expect(mocks.request.mock.calls[0]?.[0]).toBe('https://example.test/demo')
    expect(mocks.request.mock.calls[0]?.[1].body).toBe('pre-value')
    expect(mocks.request.mock.calls[0]?.[1].maxRedirections).toBe(0)
    expect(result.scriptResults?.[1]?.tests[0]?.ok).toBe(true)
    expect(session()).toMatchObject({
      path: 'demo',
      value: 'post-value',
      extracted: 'response-secret',
    })
    expect(JSON.stringify(mocks.history.mock.calls)).not.toContain('pre-value')
    expect(mocks.saved.runtime.scripts.preRequest).toBe('')
  })
  it('rolls back writes and extraction on post exceptions or failed tests', async () => {
    for (const post of [
      'throw new Error("secret")',
      'mc.test("failure", () => mc.assert(false))',
    ]) {
      const p = payload('mc.variables.set("path", "demo")', post)
      allow(p)
      const result = await executeHttpRequest(p)
      expect(result.status).toBe(200)
      expect(session()).toEqual({})
    }
  })
  it('does not call post or commit on a pre error / transport error', async () => {
    const p = payload(
      'mc.variables.set("path", "demo"); throw Error()',
      'mc.variables.set("post", "ran")',
    )
    allow(p)
    await executeHttpRequest(p)
    expect(mocks.request).not.toHaveBeenCalled()
    expect(session()).toEqual({})
    p.runtime!.scripts!.preRequest = 'mc.variables.set("path", "demo")'
    allow(p)
    mocks.request.mockRejectedValueOnce(new Error('transport'))
    await executeHttpRequest(p)
    expect(session()).toEqual({})
  })
  it('blocks a destination origin change', async () => {
    const p = payload('mc.variables.set("host", "other.test")')
    p.request.url = 'https://{{host}}/demo'
    allow(p)
    expect((await executeHttpRequest(p)).scriptResults?.at(-1)?.error).toBe(
      'destination',
    )
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('invalidates changed code, clears grants on removal and supports explicit revocation', () => {
    const p = payload('mc.assert(true)')
    allow(p)
    expect(scriptsTrusted(1, p.runtime!.scripts)).toBe(true)
    expect(
      scriptsTrusted(1, { preRequest: 'mc.assert(false)', postResponse: '' }),
    ).toBe(false)
    expect(scriptsTrusted(1, p.runtime!.scripts)).toBe(false)
    allow(p)
    scriptsTrusted(1, { preRequest: '', postResponse: '' })
    expect(scriptsTrusted(1, p.runtime!.scripts)).toBe(false)
    allow(p)
    setScriptTrust(1, p.runtime!.scripts!, false)
    expect(scriptsTrusted(1, p.runtime!.scripts)).toBe(false)
  })
  it('does not transfer grants to another vault or silently changed saved code', () => {
    const p = payload('mc.assert(true)')
    allow(p)
    mocks.vault = '/imported-vault'
    expect(scriptsTrusted(1, p.runtime!.scripts)).toBe(false)
    mocks.vault = '/vault'
    mocks.saved.runtime.scripts.preRequest = 'other()'
    expect(scriptsTrusted(1, p.runtime!.scripts)).toBe(false)
  })
  it('supports saving the exact trusted draft', () => {
    const p = payload('mc.assert(true)')
    allow(p)
    mocks.saved.runtime.scripts = p.runtime!.scripts!
    expect(scriptsTrusted(1, p.runtime!.scripts)).toBe(true)
  })
  it('uses runner variables only and does not touch manual session', async () => {
    const p = payload('mc.variables.set("value", "runner")')
    allow(p)
    const variables = {}
    await executeHttpRequest(p, {
      environment: { variables: {}, maskedVariables: {}, secretValues: [] },
      variables,
      signal: new AbortController().signal,
      isCurrent: () => true,
    })
    expect(variables).toMatchObject({ value: 'runner' })
    expect(session()).toEqual({})
    expect(mocks.history).not.toHaveBeenCalled()
  })
})

it.each(['pre', 'post', 'extraction'] as const)(
  'rolls back staged writes on %s budget overflow',
  async (phase) => {
    const initial = new Map(
      Array.from({ length: 8 }, (_, i) => [`value${i}`, 'x'.repeat(250_000)]),
    )
    // Near the scope limit, while still fitting within the script input limit.
    initial.set('padding', 'p'.repeat(80_000))
    commitHttpSession(getHttpSession('/vault', null).generation, initial)
    const before = session()
    const write
      = 'mc.variables.set("one", "a".repeat(16000)); mc.variables.set("two", "b".repeat(16000))'
    const p
      = phase === 'pre'
        ? payload(write)
        : phase === 'post'
          ? payload('mc.variables.set("path", "demo")', write)
          : payload('mc.variables.set("path", "demo")')
    if (phase === 'extraction') {
      mocks.request.mockImplementationOnce(async () => ({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: Readable.from([JSON.stringify({ token: 'z'.repeat(100_000) })]),
      }))
    }
    allow(p)
    const result = await executeHttpRequest(p)
    expect(session()).toEqual(before)
    if (phase === 'extraction') {
      expect(result.runtimeResults?.extractions[0]).toMatchObject({
        ok: false,
        errorCode: 'scopeLimit',
      })
    }
    else {
      expect(result.scriptResults?.at(-1)?.error).toBe('limit')
    }
    if (phase === 'pre')
      expect(mocks.request).not.toHaveBeenCalled()
    else expect(result.status).toBe(200)
  },
)
