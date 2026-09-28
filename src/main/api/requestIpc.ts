import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type {
  ApiTransportRequest,
  ApiTransportResponse,
} from '../../shared/apiTransport'

function normalizeRendererUrl(value: string): string | null {
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return url.toString()
  }
  catch {
    return null
  }
}

export function isTrustedApiRequest(
  event: IpcMainInvokeEvent,
  webContents: WebContents,
  expectedRendererUrl: string,
): boolean {
  const senderFrame = event.senderFrame
  const expectedUrl = normalizeRendererUrl(expectedRendererUrl)

  return (
    event.sender === webContents
    && senderFrame !== null
    && senderFrame === webContents.mainFrame
    && expectedUrl !== null
    && normalizeRendererUrl(senderFrame.url) === expectedUrl
  )
}

export function registerApiRequestHandler(
  webContents: WebContents,
  expectedRendererUrl: string,
  sessionToken: string,
  port: number,
  recordTiming?: (name: string, durationMs: number, status: string) => void,
): void {
  const origin = `http://127.0.0.1:${port}`
  webContents.ipc.handle(
    'system:api-request',
    async (
      event,
      payload: ApiTransportRequest,
    ): Promise<ApiTransportResponse> => {
      if (!isTrustedApiRequest(event, webContents, expectedRendererUrl)) {
        throw new Error('Unauthorized IPC sender')
      }

      const url = new URL(payload.url)
      if (url.origin !== origin || url.username || url.password) {
        throw new Error('Unauthorized API destination')
      }

      // Never forward arbitrary renderer headers, cookies or redirects. The bearer
      // remains in main; this bridge can reach only the app's own loopback API.
      const incomingHeaders = new Headers(payload.headers)
      const headers = new Headers({ authorization: `Bearer ${sessionToken}` })
      for (const name of ['accept', 'content-type']) {
        const value = incomingHeaders.get(name)
        if (value)
          headers.set(name, value)
      }

      const started = recordTiming ? performance.now() : 0
      const segments = url.pathname.split('/').filter(Boolean)
      const domain = ['snippets', 'notes', 'http-requests'].includes(
        segments[0],
      )
        ? segments[0]
        : 'other'
      const operation
        = segments.length === 1
          ? 'list'
          : /^\d+$/.test(segments[1]) && segments.length === 2
            ? 'item'
            : 'other'
      try {
        const response = await fetch(url, {
          method: payload.method,
          headers,
          body: payload.body,
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
        })
        const body = await response.arrayBuffer()
        recordTiming?.(
          `api.${domain}.${payload.method}.${operation}`,
          performance.now() - started,
          response.ok ? 'ok' : 'error',
        )
        return {
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.entries()),
          body,
        }
      }
      catch (error) {
        recordTiming?.(
          `api.${domain}.${payload.method}.${operation}`,
          performance.now() - started,
          'error',
        )
        throw error
      }
    },
  )
}
