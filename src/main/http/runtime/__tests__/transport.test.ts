import type { RequestListener } from 'node:http'
import type { HttpExecutePayload } from '../../../types/http'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { createSecureServer } from 'node:http2'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HttpCookieJar } from '../../cookies/jar'
import { executeHttpRequest } from '../execute'
import { resetHttpSession } from '../session'

const state = vi.hoisted(() => ({ jar: null as any }))
vi.mock('../../cookies/store', () => ({ getHttpCookieJar: () => state.jar }))
vi.mock('../../secrets', () => ({ getEnvironmentSecrets: () => ({}) }))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => '/transport-test',
}))
vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    environments: {
      getActiveEnvironmentId: () => null,
      getEnvironments: () => [],
    },
    history: { appendEntry: () => {} },
  }),
}))
const servers: ReturnType<typeof createServer>[] = []
async function server(handler: RequestListener) {
  const instance = createServer(handler)
  servers.push(instance)
  await new Promise<void>((resolve, reject) => {
    instance.once('error', reject)
    instance.listen(0, '127.0.0.1', resolve)
  })
  return `http://127.0.0.1:${(instance.address() as { port: number }).port}`
}
function payload(url: string): HttpExecutePayload {
  return {
    requestId: null,
    environmentId: null,
    request: {
      method: 'POST',
      url,
      headers: [],
      query: [],
      auth: { type: 'none' },
      bodyType: 'text',
      body: 'replay body',
      formData: [],
    },
    transport: { followRedirects: true, timeoutMs: 1000 },
  }
}
beforeEach(() => {
  resetHttpSession()
  state.jar = new HttpCookieJar()
  state.jar.enabled = () => true
})
afterEach(async () => {
  for (const instance of servers.splice(0)) {
    instance.closeAllConnections()
    await new Promise<void>(resolve => instance.close(() => resolve()))
  }
})

it.each([307, 308])(
  'replays body and sends hop cookies on %s redirects',
  async (status) => {
    const seen: { method?: string, body: string, cookie?: string }[] = []
    const origin = await server(async (req, res) => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      seen.push({
        method: req.method,
        body: Buffer.concat(chunks).toString(),
        cookie: req.headers.cookie,
      })
      if (req.url === '/start') {
        res.writeHead(status, {
          'location': '/end',
          'set-cookie': 'sid=hop; Path=/',
        })
      }
      res.end('done')
    })
    const result = await executeHttpRequest(payload(`${origin}/start`))
    expect(result.status).toBe(200)
    expect(seen).toEqual([
      { method: 'POST', body: 'replay body', cookie: undefined },
      { method: 'POST', body: 'replay body', cookie: 'sid=hop' },
    ])
  },
)
it('removes sensitive headers across origins and prunes body on 303', async () => {
  let received: any
  const destination = await server(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    received = { method: req.method, headers: req.headers, body }
    res.end('done')
  })
  const origin = await server((_req, res) => {
    res.writeHead(303, { location: destination })
    res.end()
  })
  const input = payload(origin)
  input.request.headers = [
    { key: 'Authorization', value: 'synthetic' },
    { key: 'Cookie', value: 'manual=synthetic' },
  ]
  expect((await executeHttpRequest(input)).status).toBe(200)
  expect(received.method).toBe('GET')
  expect(received.body).toBe('')
  expect(received.headers.authorization).toBeUndefined()
  expect(received.headers.cookie).toBeUndefined()
  expect(received.headers['content-type']).toBeUndefined()
})
it('stops at the configured redirect count and supports disabling redirects', async () => {
  let calls = 0
  const origin = await server((_req, res) => {
    calls++
    res.writeHead(302, { location: '/loop' })
    res.end('redirect')
  })
  const input = payload(origin)
  input.transport!.maxRedirects = 2
  expect((await executeHttpRequest(input)).status).toBe(302)
  expect(calls).toBe(3)
  input.transport!.followRedirects = false
  expect((await executeHttpRequest(input)).status).toBe(302)
  expect(calls).toBe(4)
})
it('enforces timeout and preserves cancellation with timeout disabled', async () => {
  const origin = await server(() => {})
  const input = payload(origin)
  input.transport!.timeoutMs = 30
  expect((await executeHttpRequest(input)).error).toContain('Timeout')
  input.transport!.timeoutMs = 0
  const controller = new AbortController()
  const pending = executeHttpRequest(input, undefined, controller.signal)
  setTimeout(() => controller.abort(), 30)
  const result = await pending
  expect(result.error ?? '').not.toContain('Timeout')
  expect(result.discarded).toBe(true)
})
it('unlimited timeout waits for a slow body and unlimited size retains the response', async () => {
  const origin = await server((_req, res) => {
    res.setHeader('content-type', 'text/plain')
    setTimeout(() => res.end('123456789'), 40)
  })
  const input = payload(origin)
  input.transport = { timeoutMs: 0, maxResponseBytes: 0 }
  expect(await executeHttpRequest(input)).toMatchObject({
    body: '123456789',
    truncated: false,
  })
  input.transport.maxResponseBytes = 3
  expect(await executeHttpRequest(input)).toMatchObject({
    body: '123',
    truncated: true,
    sizeBytes: 3,
  })
})

it.each([301, 302, 303, 307, 308])(
  'honors explicit original method for redirect %s',
  async (status) => {
    let received: { method?: string, body: string } | undefined
    const origin = await server(async (req, res) => {
      let body = ''
      for await (const chunk of req) body += chunk
      if (req.url === '/start')
        res.writeHead(status, { location: '/end' })
      else received = { method: req.method, body }
      res.end('done')
    })
    for (const preserve of [true, false]) {
      const input = payload(`${origin}/start`)
      input.transport!.followOriginalHttpMethod = preserve
      expect((await executeHttpRequest(input)).status).toBe(200)
      const rewrite = !preserve && [301, 302, 303].includes(status)
      expect(received).toEqual({
        method: rewrite ? 'GET' : 'POST',
        body: rewrite ? '' : 'replay body',
      })
    }
  },
)
it.each([true, false])(
  'controls cross-origin authorization and removes Referer (%s)',
  async (forward) => {
    let headers: any
    const destination = await server((req, res) => {
      headers = req.headers
      res.end('done')
    })
    const origin = await server((_req, res) => {
      res.writeHead(307, { location: destination })
      res.end()
    })
    const input = payload(origin)
    input.transport = {
      followRedirects: true,
      followAuthorizationHeader: forward,
      removeRefererHeaderOnRedirect: true,
    }
    input.request.headers = [
      { key: 'Authorization', value: 'synthetic' },
      { key: 'Referer', value: origin },
      { key: 'Cookie', value: 'manual=synthetic' },
      { key: 'Proxy-Authorization', value: 'synthetic-proxy' },
    ]
    expect((await executeHttpRequest(input)).status).toBe(200)
    expect(headers.authorization).toBe(forward ? 'synthetic' : undefined)
    expect(headers.referer).toBeUndefined()
    expect(headers.cookie).toBeUndefined()
    expect(headers['proxy-authorization']).toBeUndefined()
  },
)
it('preserves already encoded query bytes when automatic encoding is off', async () => {
  let path: string | undefined
  const origin = await server((req, res) => {
    path = req.url
    res.end('done')
  })
  const input = payload(origin)
  input.transport!.encodeUrl = false
  input.request.query = [{ key: 'q', value: 'a%20b+c' }]
  expect((await executeHttpRequest(input)).status).toBe(200)
  expect(path).toBe('/?q=a%20b+c')
  input.request.query[0].value = 'a b'
  expect((await executeHttpRequest(input)).error).toBe(
    'HTTP_URL_ENCODING_REQUIRED',
  )
})
it('rejects HTTP/2 on plaintext URLs before sending', async () => {
  let calls = 0
  const origin = await server((_req, res) => {
    calls++
    res.end()
  })
  const input = payload(origin)
  input.transport!.protocolVersion = 'http2'
  expect((await executeHttpRequest(input)).error).toBe('HTTP2_HTTPS_REQUIRED')
  expect(calls).toBe(0)
})

it('negotiates HTTP versions over TLS and rejects HTTP/1 fallback in forced HTTP/2', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'masscode-http2-'))
  const keyPath = join(directory, 'key.pem')
  const certPath = join(directory, 'cert.pem')
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' },
  )
  const tls = { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  rmSync(directory, { recursive: true })
  const instance = createSecureServer(
    { ...tls, allowHTTP1: true },
    (req, res) => {
      res.setHeader('content-type', 'text/plain')
      res.end(req.httpVersion)
    },
  )
  const sockets = new Set<any>()
  instance.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  await new Promise<void>(resolve =>
    instance.listen(0, '127.0.0.1', resolve),
  )
  try {
    const origin = `https://127.0.0.1:${(instance.address() as { port: number }).port}`
    for (const [version, expected] of [
      ['http1', '1.1'],
      ['auto', '2.0'],
      ['http2', '2.0'],
    ] as const) {
      const input = payload(origin)
      input.transport = {
        protocolVersion: version,
        skipCertificateVerification: true,
        timeoutMs: 2000,
      }
      expect((await executeHttpRequest(input)).body).toBe(expected)
    }
    const input = payload(origin)
    input.transport = { protocolVersion: 'http2', timeoutMs: 2000 }
    expect((await executeHttpRequest(input)).error).toBeTruthy()
  }
  finally {
    sockets.forEach(socket => socket.destroy())
    await new Promise<void>(resolve => instance.close(() => resolve()))
  }
  const { createServer: createHttpsServer } = await import('node:https')
  const h1 = createHttpsServer(tls, (_req, res) => {
    res.setHeader('content-type', 'text/plain')
    res.end('h1')
  })
  await new Promise<void>(resolve => h1.listen(0, '127.0.0.1', resolve))
  try {
    const input = payload(
      `https://127.0.0.1:${(h1.address() as { port: number }).port}`,
    )
    input.transport = {
      protocolVersion: 'http2',
      skipCertificateVerification: true,
      timeoutMs: 2000,
    }
    expect((await executeHttpRequest(input)).error).toBe(
      'HTTP2_NOT_NEGOTIATED',
    )
    input.transport.protocolVersion = 'auto'
    expect((await executeHttpRequest(input)).body).toBe('h1')
  }
  finally {
    h1.closeAllConnections()
    await new Promise<void>(resolve => h1.close(() => resolve()))
  }
})
