import type { HttpRuntime } from '../../../../shared/httpRuntime'
import type { HttpExecutePayload } from '../../../types/http'
import type { HttpImportRequest } from '../types'
import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { buildSchema, graphql as runGraphql } from 'graphql'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeHttpRequest } from '../../runtime/execute'
import {
  commitHttpSession,
  getHttpSession,
  resetHttpSession,
} from '../../runtime/session'
import { scriptsTrusted, setScriptTrust } from '../../scripts/trust'
import { previewHttpImport } from '../index'
import { parseOpenCollectionFiles } from '../opencollection'
import { persistHttpImportResult } from '../persist'
import { parsePostmanFiles } from '../postman'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  setCookiesEnabled: vi.fn(),
  history: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
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
vi.mock('../../cookies/store', () => ({
  getHttpCookieJar: () => ({
    enabled: () => false,
    setEnabled: mocks.setCookiesEnabled,
  }),
}))
vi.mock('undici', () => ({ Agent: class {}, request: mocks.request }))
vi.mock('../../secrets', () => ({ getEnvironmentSecrets: () => ({}) }))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => '/import-test-vault',
}))
vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    folders: {
      createFolder: mocks.createFolder,
      updateFolder: mocks.updateFolder,
    },
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
  mocks.createFolder.mockImplementation(() => ({
    id: mocks.createFolder.mock.calls.length,
  }))
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

  it('inherits Postman transport profiles and persists item overrides', () => {
    const result = parsePostmanFiles([
      {
        name: 'transport.json',
        content: JSON.stringify({
          info: {
            name: 'Transport',
            schema:
              'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          protocolProfileBehavior: {
            strictSSL: false,
            maxRedirects: 8,
            protocolVersion: 'auto',
            disableUrlEncoding: true,
            followAuthorizationHeader: true,
          },
          item: [
            {
              name: 'Folder',
              protocolProfileBehavior: {
                followRedirects: false,
                followOriginalHttpMethod: true,
                removeRefererHeaderOnRedirect: true,
              },
              item: [
                {
                  name: 'Request',
                  protocolProfileBehavior: {
                    strictSSL: true,
                    maxRedirects: 0,
                    protocolVersion: 'http2',
                    followAuthorizationHeader: false,
                  },
                  request: { method: 'GET', url: 'https://example.test' },
                },
              ],
            },
          ],
        }),
      },
    ])
    const expected = {
      skipCertificateVerification: false,
      followRedirects: false,
      maxRedirects: 0,
      protocolVersion: 'http2',
      encodeUrl: false,
      followAuthorizationHeader: false,
      followOriginalHttpMethod: true,
      removeRefererHeaderOnRedirect: true,
    }
    expect(result.collections[0].requests[0].runtime?.transport).toEqual(
      expected,
    )
    persistHttpImportResult(result)
    expect(mocks.records.get(1)?.runtime?.transport).toEqual(expected)
  })
  it('persists Postman disableCookies against the newly created request ID', () => {
    const result = parsePostmanFiles([
      {
        name: 'cookies.json',
        content: JSON.stringify({
          info: {
            name: 'Cookies',
            schema:
              'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Disabled',
              protocolProfileBehavior: { disableCookies: true },
              request: { method: 'GET', url: 'https://example.com' },
            },
          ],
        }),
      },
    ])
    persistHttpImportResult(result)
    expect(mocks.setCookiesEnabled).toHaveBeenCalledWith(1, false)
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

describe('postman data roundtrip', () => {
  it('persists collection and folder Markdown through name conflicts', () => {
    const result = parsePostmanFiles([
      {
        name: 'qa.json',
        content: JSON.stringify({
          info: {
            name: 'QA',
            schema: 'postman',
            description: '# Roundtrip QA',
          },
          item: [{ name: 'Folder', description: 'Folder **QA**.', item: [] }],
        }),
      },
    ])
    mocks.createFolder.mockImplementationOnce(() => {
      throw new Error('NAME_CONFLICT:exists')
    })
    const summary = persistHttpImportResult(result)
    expect(summary.createdCollectionNames).toEqual(['QA 1'])
    expect(mocks.updateFolder).toHaveBeenNthCalledWith(1, 2, {
      collectionConfig: expect.objectContaining({
        documentation: '# Roundtrip QA',
      }),
    })
    expect(mocks.createFolder).toHaveBeenLastCalledWith({
      name: 'Folder',
      parentId: 2,
    })
    expect(mocks.updateFolder).toHaveBeenNthCalledWith(2, 3, {
      collectionConfig: expect.objectContaining({
        documentation: 'Folder **QA**.',
      }),
    })
  })

  it('sends imported duplicate headers, encoded fields and GraphQL objects over real HTTP', async () => {
    // Resolve the application's CommonJS dependency, as Electron main does.
    const realUndici = createRequire(__filename)(
      'undici',
    ) as typeof import('undici')
    const dispatcher = new realUndici.Agent()
    mocks.request.mockImplementation((url, options) =>
      realUndici.request(url, { ...options, dispatcher }),
    )
    const tempDir = mkdtempSync(join(tmpdir(), 'mc-parity-'))
    const binaryPath = join(tempDir, 'bytes.bin')
    const bytes = Buffer.from([0, 255, 128, 13, 10, 65])
    writeFileSync(binaryPath, bytes)
    const server = createServer(async (request, response) => {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      response.setHeader('Content-Type', 'application/json')
      if (request.url === '/graphql') {
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const result = await runGraphql({
          schema: buildSchema('type Query { id: String! }'),
          source: body.query,
          variableValues: body.variables,
          rootValue: { id: () => 'qa-1' },
        })
        response.end(JSON.stringify(result))
        return
      }
      response.end(
        JSON.stringify({
          method: request.method,
          url: request.url,
          headers: request.headers,
          base64: Buffer.concat(chunks).toString('base64'),
          body: Buffer.concat(chunks).toString(),
        }),
      )
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    try {
      const address = server.address()
      if (!address || typeof address === 'string')
        throw new Error('Missing server address')
      const session = getHttpSession('/import-test-vault', null)
      commitHttpSession(
        session.generation,
        new Map([['value', 'a&b=c+d% Привет']]),
      )
      const result = parsePostmanFiles([
        {
          name: 'qa.json',
          content: JSON.stringify({
            info: { name: 'QA', schema: 'postman' },
            item: [
              {
                name: 'Form',
                request: {
                  method: 'POST',
                  url: `http://127.0.0.1:${address.port}/form`,
                  header: [
                    { key: 'X-QA', value: 'first' },
                    { key: 'x-qa', value: 'second' },
                    { key: 'X-Off', value: 'off', disabled: true },
                  ],
                  body: {
                    mode: 'urlencoded',
                    urlencoded: [
                      { key: 'special', value: 'a&b=c+d%' },
                      { key: 'tag', value: 'one' },
                      { key: 'tag', value: 'two' },
                      { key: 'empty', value: '' },
                      { key: 'variable', value: '{{value}}' },
                    ],
                  },
                },
              },
              {
                name: 'GraphQL',
                request: {
                  method: 'POST',
                  url: `http://127.0.0.1:${address.port}/graphql`,
                  body: {
                    mode: 'graphql',
                    graphql: {
                      query: 'query { id }',
                      variables: '{"id":"qa-1"}',
                    },
                  },
                },
              },
            ],
          }),
        },
      ])
      const form = await executeHttpRequest({
        requestId: null,
        environmentId: null,
        request: result.collections[0].requests[0],
      })
      expect(form.error).toBeUndefined()
      expect(form.status).toBe(200)
      const echoed = JSON.parse(form.body)
      expect(echoed.headers['x-qa']).toBe('first, second')
      expect(echoed.headers['x-off']).toBeUndefined()
      expect(echoed.headers['content-type']).toBe(
        'application/x-www-form-urlencoded',
      )
      expect([...new URLSearchParams(echoed.body)]).toEqual([
        ['special', 'a&b=c+d%'],
        ['tag', 'one'],
        ['tag', 'two'],
        ['empty', ''],
        ['variable', 'a&b=c+d% Привет'],
      ])
      const base = result.collections[0].requests[0]
      for (const method of [
        'GET',
        'HEAD',
        'OPTIONS',
        'DELETE',
        'PATCH',
        'PUT',
      ] as const) {
        const result = await executeHttpRequest({
          requestId: null,
          environmentId: null,
          request: { ...base, method, bodyType: 'none', body: null },
        })
        expect(result.status).toBe(200)
        if (method === 'HEAD')
          expect(result.body).toBe('')
        else expect(JSON.parse(result.body).method).toBe(method)
      }
      const xml = '<root>Привет &amp; QA</root>'
      const xmlResult = await executeHttpRequest({
        requestId: null,
        environmentId: null,
        request: {
          ...base,
          bodyType: 'text',
          body: xml,
          headers: [{ key: 'Content-Type', value: 'application/xml' }],
        },
      })
      expect(JSON.parse(xmlResult.body).body).toBe(xml)
      for (const location of ['header', 'query'] as const) {
        const authenticated = await executeHttpRequest({
          requestId: null,
          environmentId: null,
          request: {
            ...base,
            bodyType: 'none',
            body: null,
            auth: { type: 'apikey', in: location, key: 'qa-key', value: 'a&b' },
          },
        })
        const echoed = JSON.parse(authenticated.body)
        if (location === 'header') {
          expect(echoed.headers['qa-key']).toBe('a&b')
        }
        else {
          expect(
            new URL(echoed.url, 'http://localhost').searchParams.get('qa-key'),
          ).toBe('a&b')
        }
      }
      const binary = await executeHttpRequest({
        requestId: null,
        environmentId: null,
        request: { ...base, bodyType: 'binary', body: binaryPath },
      })
      expect(binary.error).toBeUndefined()
      expect(JSON.parse(binary.body).base64).toBe(bytes.toString('base64'))
      const multipart = await executeHttpRequest({
        requestId: null,
        environmentId: null,
        request: {
          ...base,
          bodyType: 'multipart',
          body: null,
          formData: [
            { key: 'upload', value: binaryPath, type: 'file' },
            {
              key: 'off',
              value: '/missing/disabled',
              type: 'file',
              enabled: false,
            },
            { key: 'text', value: 'hello', type: 'text' },
          ],
        },
      })
      expect(multipart.error).toBeUndefined()
      const multipartBytes = Buffer.from(
        JSON.parse(multipart.body).base64,
        'base64',
      )
      expect(multipartBytes.includes(bytes)).toBe(true)
      expect(multipartBytes.toString()).toContain('name="text"')
      expect(multipartBytes.toString()).not.toContain('name="off"')
      const missing = await executeHttpRequest({
        requestId: null,
        environmentId: null,
        request: {
          ...base,
          bodyType: 'binary',
          body: join(tempDir, 'missing'),
        },
      })
      expect(missing.error).toBe('HTTP_BODY_FILE_UNAVAILABLE')
      const graphql = await executeHttpRequest({
        requestId: null,
        environmentId: null,
        request: result.collections[0].requests[1],
      })
      expect(graphql.status).toBe(200)
      expect(JSON.parse(graphql.body)).toEqual({ data: { id: 'qa-1' } })
      const invalid = await executeHttpRequest({
        requestId: null,
        environmentId: null,
        request: {
          ...result.collections[0].requests[1],
          body: JSON.stringify({
            query: 'query { missing }',
            variables: '{}',
            operationName: '',
          }),
        },
      })
      expect(JSON.parse(invalid.body).errors[0].message).toContain(
        'Cannot query field',
      )
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
      await dispatcher.close()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      )
    }
  })
})
