import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { Agent, request } from 'undici'
import { afterEach, describe, expect, it } from 'vitest'
import { httpConsole } from '../console'
import {
  captureDispatcherFactory,
  captureHttpNetwork,
  finishHttpNetwork,
} from '../network'

afterEach(() => httpConsole.clear())
describe('hTTP console wire capture', () => {
  it('captures actual headers, redirects, response and socket without unrelated requests', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/final' })
        res.end('redirect body')
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address() as { port: number }
    const url = `http://127.0.0.1:${address.port}`
    try {
      const ids: string[] = []
      const dispatcher = new Agent({
        factory: captureDispatcherFactory,
      })
      const response = await captureHttpNetwork(
        { executionId: 'capture', body: '', ids },
        () =>
          request(`${url}/redirect`, {
            dispatcher,
            maxRedirections: 5,
            headers: { 'X-QA': 'wire' },
          }),
      )
      await response.body.text()
      finishHttpNetwork(ids.at(-1), {}, 1)
      const entries = httpConsole.read().entries
      expect(entries).toHaveLength(2)
      expect(entries.map(entry => entry.status)).toEqual([302, 200])
      expect(entries[1].details?.requestHeaders).toContain('X-QA: wire')
      expect(entries[1].details?.network).toMatchObject({
        remoteAddress: '127.0.0.1',
      })
      expect(entries[0].details?.responseBody).toBe('redirect body')
      expect(entries[1].details?.responseBody).toBe('{"ok":true}')
      const unrelated = await request(`${url}/final`, { dispatcher })
      await unrelated.body.text()
      expect(httpConsole.read().entries).toHaveLength(2)
      await dispatcher.close()
    }
    finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
  it('captures binary and encoded multipart bodies without consuming the transport', async () => {
    const received: Buffer[] = []
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk)
      received.push(Buffer.concat(chunks))
      res.end(Buffer.from([0, 1, 254, 255]))
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const dispatcher = new Agent({
      factory: captureDispatcherFactory,
    })
    try {
      const form = new FormData()
      form.append('text', 'Привет')
      const encoded = new Response(form)
      const bodies = [
        Buffer.from([0, 1, 254, 255]),
        Buffer.from(await encoded.arrayBuffer()),
      ]
      for (const body of bodies) {
        const response = await captureHttpNetwork(
          { executionId: 'body', ids: [], body: 'must not appear' },
          () =>
            request(url, {
              dispatcher,
              method: 'POST',
              body,
              headers: { 'content-type': encoded.headers.get('content-type')! },
            }),
        )
        expect(Buffer.from(await response.body.arrayBuffer())).toEqual(
          Buffer.from([0, 1, 254, 255]),
        )
      }
      expect(received).toEqual(bodies)
      const entries = httpConsole.read().entries
      expect(entries[0].details).toMatchObject({
        requestBody: 'AAH+/w==',
        requestBodyEncoding: 'base64',
        responseBody: 'AAH+/w==',
        responseBodyEncoding: 'base64',
      })
      expect(entries[1].details?.requestBody).toBe(bodies[1].toString())
      expect(entries[1].details?.requestBody).toContain('Привет')
    }
    finally {
      await dispatcher.close()
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
  it('bounds previews at a UTF-8 boundary while preserving the full response', async () => {
    const body = `${'Я'.repeat(40_000)}!`
    const server = createServer((_req, res) => res.end(body))
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const dispatcher = new Agent({ factory: captureDispatcherFactory })
    try {
      const ids: string[] = []
      const response = await captureHttpNetwork(
        { executionId: 'large', body: '', ids },
        () =>
          request(
            `http://127.0.0.1:${(server.address() as { port: number }).port}`,
            { dispatcher },
          ),
      )
      expect(await response.body.text()).toBe(body)
      finishHttpNetwork(ids.at(-1), { responseTruncated: false }, 1)
      expect(httpConsole.read().entries[0]).toMatchObject({
        truncated: true,
        details: {
          responseBody: 'Я'.repeat(32_768),
          responseBodyEncoding: 'utf8',
          responseBodyBytes: 80_001,
          responseBodyTruncated: true,
          responseTruncated: false,
        },
      })
    }
    finally {
      await dispatcher.close()
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
