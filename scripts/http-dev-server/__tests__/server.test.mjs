import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer, request } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { defaultPorts, startServers } from '../server.mjs'

const cleanups = []
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(close => close()))
})
async function start() {
  const server = await startServers(Object.fromEntries(Object.keys(defaultPorts).map(name => [name, 0])))
  cleanups.push(server.close)
  return server
}
const commerceHeaders = { 'authorization': 'Bearer demo-commerce-token', 'content-type': 'application/json' }

it('preserves legacy scripts, commerce and GraphQL responses and resets instance state', async () => {
  const { addresses: a } = await start()
  expect(await (await fetch(`${a.scripts}/health`)).json()).toEqual({ demo: 'masscode-http-scripts' })
  expect(await (await fetch(`${a.scripts}/anything`, { method: 'POST', body: 'hello' })).json()).toEqual({ token: 'demo-token', received: 'hello' })
  expect((await fetch(`${a.showcase}/v1/products`)).status).toBe(401)
  expect(await (await fetch(`${a.showcase}/v1/auth/token`, { method: 'POST' })).json()).toMatchObject({ token: 'demo-commerce-token' })
  expect(await (await fetch(`${a.showcase}/v1/products?category=bags`, { headers: commerceHeaders })).json()).toMatchObject({ pagination: { total: 2 } })
  const createOrder = () => fetch(`${a.showcase}/v1/orders`, { method: 'POST', headers: commerceHeaders, body: JSON.stringify({ customerId: 'cus_2048', items: [{ productId: 'prd_weekender', quantity: 2 }] }) }).then(res => res.json())
  expect(await createOrder()).toMatchObject({ id: 'ord_1043', total: 183 })
  const graphql = query => fetch(`${a.graphql}/graphql`, { method: 'POST', headers: { authorization: 'Bearer graphql-demo' }, body: JSON.stringify({ query }) }).then(res => res.json())
  expect((await fetch(`${a.graphql}/graphql`, { method: 'POST' })).status).toBe(401)
  expect(await graphql('{ hello token broken }')).toMatchObject({ data: { hello: 'Hello GraphQL', token: 'graphql-demo', broken: null }, errors: [{ extensions: { code: 'DEMO_ERROR' } }] })
  await graphql('mutation { rename(id: "1", name: "Grace") { name } }')
  expect(await graphql('{ user(id: "1") { name } }')).toEqual({ data: { user: { name: 'Grace' } } })
  await fetch(`${a.showcase}/v1/orders/ord_1042/fulfillment`, { method: 'POST', headers: commerceHeaders })
  const independent = await start()
  expect(await (await fetch(`${independent.addresses.showcase}/v1/orders`, { headers: commerceHeaders })).json()).toMatchObject({ pagination: { total: 1 } })
  expect(await (await fetch(`${a.transport}/reset`, { method: 'POST' })).json()).toEqual({ reset: true })
  expect(await graphql('{ user(id: "1") { name } }')).toEqual({ data: { user: { name: 'Ada' } } })
  expect(await (await fetch(`${a.showcase}/v1/orders/ord_1042`, { headers: commerceHeaders })).json()).toMatchObject({ status: 'paid' })
  expect(await createOrder()).toMatchObject({ id: 'ord_1043' })
})

it('serves deterministic transport bodies, timing and rejects invalid limits', async () => {
  const { addresses: a } = await start()
  expect(await (await fetch(`${a.transport}/echo?a=1&a=2`, { method: 'POST', headers: { 'x-demo': 'yes' }, body: 'payload' })).json()).toMatchObject({ method: 'POST', query: [['a', '1'], ['a', '2']], headers: { 'x-demo': 'yes' }, body: 'payload' })
  const bytes = await fetch(`${a.transport}/bytes/1048576`)
  expect(bytes.headers.get('content-length')).toBe('1048576')
  expect(await bytes.text()).toBe('x'.repeat(1048576))
  expect(await (await fetch(`${a.transport}/bytes/0`)).text()).toBe('')
  const started = performance.now()
  expect(await (await fetch(`${a.transport}/delay/40`)).json()).toEqual({ delay: 40 })
  expect(performance.now() - started).toBeGreaterThanOrEqual(35)
  expect(await (await fetch(`${a.transport}/stream?chunks=3&size=5&interval=1`)).text()).toBe('aaaaabbbbbccccc')
  expect((await fetch(`${a.transport}/status/503`)).status).toBe(503)
  for (const code of [204, 205, 304])
    expect(await (await fetch(`${a.transport}/status/${code}`)).text()).toBe('')
  for (const path of ['/status/101', '/status/600', '/bytes/-1', '/bytes/16777217', '/delay/10001', '/delay/1e2', '/stream?chunks=0', '/stream?size=65537', '/stream?chunks=100&interval=1000', '/redirect/304', '/chain/21'])
    expect((await fetch(a.transport + path)).status, path).toBe(400)
})

it('supports redirects to a real second origin and cookie round trips', async () => {
  const { addresses: a } = await start()
  for (const code of [301, 302, 303, 307, 308]) {
    const response = await fetch(`${a.transport}/redirect/${code}`, { redirect: 'manual' })
    expect(response.status).toBe(code)
    expect(response.headers.get('location')).toBe('/echo')
  }
  for (const code of [302, 303, 307, 308]) {
    const response = await fetch(`${a.transport}/redirect/${code}`, { method: 'POST', body: 'replay' })
    expect(await response.json()).toMatchObject({ method: code < 307 ? 'GET' : 'POST', body: code < 307 ? '' : 'replay' })
  }
  expect(await (await fetch(`${a.transport}/chain/3`)).json()).toEqual({ remaining: 0 })
  expect((await fetch(`${a.transport}/loop`, { redirect: 'manual' })).headers.get('location')).toBe('/loop')
  const redirect = await fetch(`${a.transport}/cross-origin`, { redirect: 'manual' })
  expect(redirect.headers.get('location')).toBe(`${a.crossOrigin}/echo`)
  const crossed = await fetch(`${a.transport}/cross-origin`)
  expect(crossed.url).toBe(`${a.crossOrigin}/echo`)
  const cookie = await fetch(`${a.transport}/cookies-set`)
  const values = cookie.headers.getSetCookie()
  expect(values).toHaveLength(2)
  expect(await (await fetch(`${a.transport}/cookies-echo`, { headers: { cookie: values.map(value => value.split(';')[0]).join('; ') } })).json()).toEqual({ cookie: 'demo=masscode; theme=dark' })
})

it('preserves WebSocket auth and echo and closes active sockets and delayed streams', async () => {
  const running = await start()
  const url = running.addresses.websocket
  const rejected = new WebSocket(`${url}/protected`)
  rejected.on('error', () => {})
  const [, response] = await once(rejected, 'unexpected-response')
  expect(response.statusCode).toBe(401)
  response.resume()
  rejected.terminate()
  const ws = new WebSocket(`${url}/protected?channel=updates`, { headers: { 'Authorization': 'Bearer demo-token', 'X-Client-ID': 'test' } })
  const [connected] = await once(ws, 'message')
  expect(JSON.parse(connected.toString())).toEqual({ type: 'connected', authenticated: true, channel: 'updates', clientId: 'test' })
  ws.send('hello')
  const [echo] = await once(ws, 'message')
  expect(echo.toString()).toBe('hello')
  const stream = await fetch(`${running.addresses.transport}/stream?chunks=10&interval=1000`)
  const reader = stream.body.getReader()
  await reader.read()
  await reader.cancel()
  const pending = fetch(`${running.addresses.transport}/delay/10000`).catch(() => null)
  const closed = once(ws, 'close')
  await running.close()
  await closed
  await pending
  await expect(fetch(`${running.addresses.scripts}/health`)).rejects.toThrow()
})

it('rolls back listeners when a later port is occupied', async () => {
  const blocker = createServer()
  blocker.listen(0, '127.0.0.1')
  await once(blocker, 'listening')
  cleanups.push(() => new Promise(resolve => blocker.close(resolve)))
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  await expect(startServers({ scripts: port, graphql: blocker.address().port }, ['scripts', 'graphql'])).rejects.toMatchObject({ code: 'EADDRINUSE' })
  probe.listen(port, '127.0.0.1')
  await once(probe, 'listening')
  await new Promise(resolve => probe.close(resolve))
})

it('survives an aborted legacy upload', async () => {
  const { addresses: a } = await start()
  const upload = request(`${a.scripts}/upload`, { method: 'POST', headers: { 'content-length': '10000' } })
  upload.on('error', () => {})
  upload.write('partial')
  await once(upload, 'socket')
  upload.destroy()
  const malformed = await new Promise((resolve, reject) => {
    const req = request(a.transport, { path: '//' }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', reject)
    req.end()
  })
  expect(malformed).toBe(400)
  expect((await fetch(`${a.transport}/echo`)).status).toBe(200)
  expect((await fetch(`${a.scripts}/health`)).status).toBe(200)
})

it('cLI prints help without listening and emits ready only with all six actual addresses', async () => {
  const cli = new URL('../index.mjs', import.meta.url)
  const help = spawn(process.execPath, [cli.pathname, '--help'])
  let helpText = ''
  help.stdout.on('data', data => helpText += data)
  expect((await once(help, 'exit'))[0]).toBe(0)
  expect(helpText).toContain('--cross-origin-port')
  const flags = ['websocket', 'scripts', 'showcase', 'graphql', 'transport', 'cross-origin'].flatMap(name => [`--${name}-port`, '0'])
  const child = spawn(process.execPath, [cli.pathname, '--', ...flags])
  cleanups.push(() => {
    child.kill('SIGKILL')
  })
  const ready = await new Promise((resolve, reject) => {
    let output = ''
    child.stdout.on('data', (data) => {
      output += data
      if (output.includes('\n'))
        resolve(JSON.parse(output.trim()))
    })
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`Early exit ${code}`)))
  })
  expect(ready.event).toBe('ready')
  expect(Object.keys(ready.addresses)).toHaveLength(6)
  for (const address of Object.values(ready.addresses)) expect(new URL(address).port).not.toBe('0')
  const exit = once(child, 'exit')
  child.kill('SIGTERM')
  expect((await exit)[0]).toBe(0)
})
