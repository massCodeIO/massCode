import { createServer } from 'node:http'
import process from 'node:process'
import { WebSocketServer } from 'ws'

// Local-only echo endpoint for manually testing the HTTP space WebSocket UI.
const http = createServer((_request, response) => {
  response.writeHead(426).end('Use a WebSocket client.')
})
const server = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })
http.on('upgrade', (request, socket, head) => {
  socket.on('error', () => {})
  const url = new URL(request.url, 'http://127.0.0.1')
  const reject = status => socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
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
http.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
http.listen(5188, '127.0.0.1', () => {
  console.log('Echo: ws://127.0.0.1:5188')
  console.log('Protected: ws://127.0.0.1:5188/protected?channel=notifications')
  console.log('Auth: Bearer demo-token | Header: X-Client-ID: masscode-demo')
  console.log('Wrong token: 401. Missing channel/client ID: 400. Ctrl+C to stop.')
})
process.on('SIGINT', () => {
  for (const socket of server.clients) socket.terminate()
  server.close()
  http.close()
})
