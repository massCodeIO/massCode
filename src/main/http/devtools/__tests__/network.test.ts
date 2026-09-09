import { createServer } from 'node:http'
import { Agent, request } from 'undici'
import { afterEach, describe, expect, it } from 'vitest'
import { httpConsole } from '../console'
import { captureHttpNetwork, finishHttpNetwork } from '../network'

afterEach(() => httpConsole.clear())
describe('hTTP console wire capture', () => {
  it('captures actual headers, redirects, response and socket without unrelated requests', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/final' })
        res.end()
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
      const dispatcher = new Agent()
      const response = await captureHttpNetwork(
        { executionId: 'capture', body: '', ids },
        () =>
          request(`${url}/redirect`, {
            dispatcher,
            maxRedirections: 5,
            headers: { 'X-QA': 'wire' },
          }),
      )
      const body = await response.body.text()
      finishHttpNetwork(ids.at(-1), { responseBody: body }, 1)
      const entries = httpConsole.read().entries
      expect(entries).toHaveLength(2)
      expect(entries.map(entry => entry.status)).toEqual([302, 200])
      expect(entries[1].details?.requestHeaders).toContain('X-QA: wire')
      expect(entries[1].details?.network).toMatchObject({
        remoteAddress: '127.0.0.1',
      })
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
})
