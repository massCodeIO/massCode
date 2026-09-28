import { createServer } from 'node:http'

export function createScriptsServer() {
  const server = createServer(async (request, response) => {
    try {
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
    }
    catch {
      response.destroy()
    }
  })

  return { server }
}
