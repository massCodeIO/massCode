import { createServer } from 'node:http'
import { Agent, request } from 'undici'
import { expect, it } from 'vitest'
import { captureDispatcherFactory } from '../../devtools/network'
import { HttpCookieJar } from '../jar'
import { withHttpCookies } from '../transport'

it('captures redirect cookies, merges manual headers and isolates disabled requests', async () => {
  const seen: (string | undefined)[] = []
  const server = createServer((req, res) => {
    seen.push(req.headers.cookie)
    if (req.url === '/login') {
      res.writeHead(302, {
        'location': '/next',
        'set-cookie': ['sid=redirect; Path=/', 'restricted=no; Path=/private'],
      })
      res.end('redirect')
    }
    else {
      res.end(req.headers.cookie ?? '')
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const agent = new Agent({ factory: captureDispatcherFactory })
  const jar = new HttpCookieJar()
  try {
    const response = await withHttpCookies(jar, () =>
      request(`${origin}/login`, {
        dispatcher: agent,
        maxRedirections: 5,
        headers: { Cookie: 'manual=yes' },
      }))
    expect(await response.body.text()).toBe('sid=redirect; manual=yes')
    expect(seen).toEqual(['manual=yes', 'sid=redirect; manual=yes'])
    const disabled = await withHttpCookies(undefined, () =>
      request(`${origin}/next`, { dispatcher: agent }))
    expect(await disabled.body.text()).toBe('')
    const isolated = await withHttpCookies(new HttpCookieJar(), () =>
      request(`${origin}/next`, { dispatcher: agent }))
    expect(await isolated.body.text()).toBe('')
  }
  finally {
    await agent.close()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
