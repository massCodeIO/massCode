import { createMcpHandler } from '@modelcontextprotocol/server'
import { Elysia } from 'elysia'
import { store } from '../../store'
import { isIntegrationTokenAuthorized } from '../integrations/auth'
import { createServer } from './server'

const REQUEST_LIMIT = 2 * 1024 * 1024

export function createMcpRoute(port: number, version: string) {
  const handler = createMcpHandler(() => createServer(version))
  return new Elysia().all(
    '/mcp',
    async ({ request }) => {
      if (store.preferences.get('api.mcp.enabled') !== true) {
        return Response.json({ message: 'MCP is disabled' }, { status: 403 })
      }
      if (
        !isIntegrationTokenAuthorized(
          request.headers.get('authorization') ?? undefined,
        )
      ) {
        return Response.json(
          { message: 'Unauthorized integration request' },
          { status: 401 },
        )
      }
      const origin = request.headers.get('origin')
      if (
        origin !== null
        && origin !== `http://localhost:${port}`
        && origin !== `http://127.0.0.1:${port}`
      ) {
        return Response.json(
          { message: 'Forbidden request origin' },
          { status: 403 },
        )
      }
      if (!['POST', 'GET', 'DELETE'].includes(request.method)) {
        return new Response(null, {
          status: 405,
          headers: { allow: 'POST, GET, DELETE' },
        })
      }
      // Count actual bytes: Content-Length can be absent or untrusted.
      if (request.body) {
        const reader = request.body.getReader()
        const chunks: Uint8Array[] = []
        let size = 0
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            size += value.byteLength
            if (size > REQUEST_LIMIT) {
              void reader.cancel().catch(() => {})
              return Response.json(
                {
                  code: 'CONTENT_TOO_LARGE',
                  message: 'Request exceeds the 2 MiB limit.',
                },
                { status: 413 },
              )
            }
            chunks.push(value)
          }
        }
        catch {
          return Response.json(
            { message: 'Invalid request body' },
            { status: 400 },
          )
        }
        finally {
          reader.releaseLock()
        }
        const body = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
          body.set(chunk, offset)
          offset += chunk.byteLength
        }
        request = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body,
        })
      }
      return handler.fetch(request)
    },
    { parse: 'none', detail: { hide: true } },
  )
}
