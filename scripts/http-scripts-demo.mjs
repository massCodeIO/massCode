import { createServer } from 'node:http'
import process from 'node:process'

const base = 'http://127.0.0.1:5189'
const server = createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ demo: 'masscode-http-scripts' }))
    return
  }
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 65536) {
      response.writeHead(413)
      response.end()
      return
    }
  }
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ token: 'demo-token', received: body }))
})
server.on('error', (error) => {
  console.error(error.code)
  process.exitCode = 1
})
server.listen(5189, '127.0.0.1', () => console.log(`Scripts demo: ${base}`))
