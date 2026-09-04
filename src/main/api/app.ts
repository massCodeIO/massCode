import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import captures from './routes/captures'
import folders from './routes/folders'
import httpEnvironments from './routes/http-environments'
import httpFolders from './routes/http-folders'
import httpHistory from './routes/http-history'
import httpImport from './routes/http-import'
import httpRequests from './routes/http-requests'
import imports from './routes/imports'
import internalLinks from './routes/internal-links'
import noteFolders from './routes/note-folders'
import noteTags from './routes/note-tags'
import notes from './routes/notes'
import notesDashboard from './routes/notes-dashboard'
import notesGraph from './routes/notes-graph'
import snippets from './routes/snippets'
import system from './routes/system'
import tags from './routes/tags'
import { isSessionTokenAuthorized } from './sessionAuth'

const CAPTURE_PATHS = new Set(['/captures', '/captures/'])
const CAPTURE_CORS_HEADERS = {
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-origin': '*',
}

interface CreateApiAppOptions {
  port: number
  sessionToken: string
  version: string
}

function isAllowedHost(host: string | null, port: number): boolean {
  if (!host) {
    return false
  }

  const normalizedHost = host.toLowerCase()
  return (
    normalizedHost === `localhost:${port}`
    || normalizedHost === `127.0.0.1:${port}`
  )
}

function isSwaggerRequest(method: string, pathname: string): boolean {
  return (
    (method === 'GET' || method === 'HEAD')
    && (pathname === '/swagger' || pathname.startsWith('/swagger/'))
  )
}

function isCaptureRequest(method: string, pathname: string): boolean {
  return (
    (method === 'POST' || method === 'OPTIONS') && CAPTURE_PATHS.has(pathname)
  )
}

export function createApiApp(
  { port, sessionToken, version }: CreateApiAppOptions,
  app = new Elysia(),
) {
  return app
    .guard({
      as: 'global',
      beforeHandle({ request, set }) {
        const url = new URL(request.url)

        if (!isAllowedHost(request.headers.get('host'), port)) {
          set.status = 403
          return { message: 'Forbidden request host' }
        }

        if (isCaptureRequest(request.method, url.pathname)) {
          if (request.method === 'OPTIONS') {
            return new Response(null, {
              headers: CAPTURE_CORS_HEADERS,
              status: 204,
            })
          }

          Object.assign(set.headers, CAPTURE_CORS_HEADERS)
          return
        }

        if (isSwaggerRequest(request.method, url.pathname)) {
          return
        }

        if (
          !isSessionTokenAuthorized(
            request.headers.get('authorization') ?? undefined,
            sessionToken,
          )
        ) {
          set.status = 401
          return { message: 'Unauthorized request' }
        }
      },
    })
    .use(
      swagger({
        documentation: {
          info: {
            title: 'massCode API',
            version,
          },
        },
      }),
    )
    .use(captures)
    .options('/captures', () => '', { detail: { hide: true } })
    .options('/captures/', () => '', { detail: { hide: true } })
    .use(snippets)
    .use(folders)
    .use(system)
    .use(tags)
    .use(notesDashboard)
    .use(notesGraph)
    .use(notes)
    .use(noteFolders)
    .use(noteTags)
    .use(internalLinks)
    .use(httpFolders)
    .use(httpRequests)
    .use(httpEnvironments)
    .use(httpHistory)
    .use(httpImport)
    .use(imports)
}
