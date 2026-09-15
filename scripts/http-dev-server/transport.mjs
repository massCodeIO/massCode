import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

export function createTransportServer({ crossOrigin = () => '', reset = () => {} } = {}) {
  const timers = new Set()
  const server = createServer(async (req, res) => {
    const send = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
    const integer = (value, max, min = 0) => {
      if (!/^\d+$/.test(value ?? '') || Number(value) < min || Number(value) > max)
        throw new Error('Invalid integer parameter')
      return Number(value)
    }
    const later = (callback, ms) => {
      let timer
      function cancel() {
        clearTimeout(timer)
        timers.delete(timer)
      }
      timer = setTimeout(() => {
        timers.delete(timer)
        res.removeListener('close', cancel)
        callback()
      }, ms)
      timers.add(timer)
      res.once('close', cancel)
    }
    try {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname === '/reset' && req.method === 'POST') {
        reset()
        send(200, { reset: true })
        return
      }
      if (url.pathname === '/echo') {
        const chunks = []
        let length = 0
        for await (const chunk of req) {
          length += chunk.length
          if (length > 1048576) {
            send(413, { error: 'body_too_large' })
            return
          }
          chunks.push(chunk)
        }
        send(200, { method: req.method, query: [...url.searchParams], headers: req.headers, body: Buffer.concat(chunks).toString('utf8') })
        return
      }
      if (req.method !== 'GET' && !/^\/(?:redirect\/|chain\/|loop$|cross-origin$)/.test(url.pathname)) {
        send(405, { error: 'method_not_allowed' })
        return
      }
      const [, route, value, extra] = url.pathname.split('/')
      if (extra !== undefined)
        throw new Error('Unexpected path segment')
      if (route === 'status') {
        const code = integer(value, 599, 200)
        if ([204, 205, 304].includes(code))
          res.writeHead(code).end()
        else
          send(code, { status: code })
      }
      else if (route === 'delay') {
        const ms = integer(value, 10000)
        later(() => send(200, { delay: ms }), ms)
      }
      else if (route === 'bytes') {
        const size = integer(value, 16777216)
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': size })
        res.end(Buffer.alloc(size, 'x'))
      }
      else if (route === 'stream') {
        const chunks = integer(url.searchParams.get('chunks') ?? '4', 100, 1)
        const size = integer(url.searchParams.get('size') ?? '1024', 65536, 1)
        const interval = integer(url.searchParams.get('interval') ?? '10', 1000)
        if (chunks * size > 16777216 || (chunks - 1) * interval > 10000)
          throw new Error('Stream limit exceeded')
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
        let index = 0
        const write = () => {
          if (res.destroyed)
            return
          const ready = res.write(Buffer.alloc(size, 97 + index % 26))
          index += 1
          if (index === chunks) {
            res.end()
            return
          }
          if (ready)
            later(write, interval)
          else
            res.once('drain', () => later(write, interval))
        }
        write()
      }
      else if (route === 'redirect') {
        const code = integer(value, 308, 301)
        if (![301, 302, 303, 307, 308].includes(code))
          throw new Error('Invalid redirect status')
        res.writeHead(code, { Location: '/echo' }).end()
      }
      else if (route === 'chain') {
        const count = integer(value, 20)
        if (count === 0)
          send(200, { remaining: 0 })
        else
          res.writeHead(302, { Location: `/chain/${count - 1}` }).end()
      }
      else if (url.pathname === '/loop') {
        res.writeHead(302, { Location: '/loop' }).end()
      }
      else if (url.pathname === '/cross-origin') {
        if (!crossOrigin())
          throw new Error('Cross origin unavailable')
        res.writeHead(302, { Location: `${crossOrigin()}/echo` }).end()
      }
      else if (url.pathname === '/cookies-set') {
        res.setHeader('Set-Cookie', ['demo=masscode; Path=/; HttpOnly; SameSite=Lax', 'theme=dark; Path=/; SameSite=Lax'])
        send(200, { set: true })
      }
      else if (url.pathname === '/cookies-echo') {
        send(200, { cookie: req.headers.cookie ?? '' })
      }
      else {
        send(404, { error: 'not_found' })
      }
    }
    catch (error) {
      if (!res.destroyed && !res.headersSent)
        send(400, { error: error.message })
    }
  })
  return { server, dispose() {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  } }
}
