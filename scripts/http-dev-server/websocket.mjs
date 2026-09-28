import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

export function createWebsocketServer() {
// Local-only echo endpoint for manually testing the HTTP space WebSocket UI.
  const http = createServer((_request, response) => {
    response.writeHead(426).end('Use a WebSocket client.')
  })
  const server = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })
  http.on('upgrade', (request, socket, head) => {
    socket.on('error', () => {})
    const reject = status => socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
    let url
    try {
      url = new URL(request.url, 'http://127.0.0.1')
    }
    catch {
      return reject('400 Bad Request')
    }
    if (!['/', '/protected'].includes(url.pathname))
      return reject('404 Not Found')
    if (url.pathname === '/protected') {
      if (request.headers.authorization !== 'Bearer demo-token')
        return reject('401 Unauthorized')
      if (!url.searchParams.get('channel') || !request.headers['x-client-id'])
        return reject('400 Bad Request')
    }
    server.handleUpgrade(request, socket, head, client => server.emit('connection', client, request))
  })
  server.on('connection', (socket, request) => {
    socket.on('error', () => {})
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname === '/protected') {
      socket.send(JSON.stringify({
        type: 'connected',
        authenticated: true,
        channel: url.searchParams.get('channel'),
        clientId: request.headers['x-client-id'],
      }))
    }
    socket.on('message', (data, binary) => socket.send(data, { binary }))
  })

  return { server: http, dispose() {
    for (const client of server.clients) client.terminate()
    server.close()
  } }
}
