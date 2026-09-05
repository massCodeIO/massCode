import type { HttpExecutePayload } from '../../../types/http'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeHttpRequest } from '../../runtime/execute'
import { getHttpSession, resetHttpSession } from '../../runtime/session'
import { scriptsTrusted, setScriptTrust } from '../trust'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  history: vi.fn(),
  vault: '/vault',
  grants: {},
  saved: {
    id: 1,
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
  mocks.vault = '/vault'
  mocks.saved.runtime.scripts = { preRequest: '', postResponse: '' }
  mocks.request.mockImplementation(async () => ({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: Readable.from(['{"token":"response-secret"}']),
  }))
})

describe('script workflow and local trust', () => {
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
