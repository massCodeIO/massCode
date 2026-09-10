import type { RequestListener } from 'node:http'
import type { HttpExecutePayload } from '../../../types/http'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
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
