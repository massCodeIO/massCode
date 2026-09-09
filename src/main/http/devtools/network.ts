import type { Buffer } from 'node:buffer'
import type { Socket } from 'node:net'
import type { TLSSocket } from 'node:tls'
import { AsyncLocalStorage } from 'node:async_hooks'
import { channel } from 'node:diagnostics_channel'
import { httpConsole } from './console'

interface Capture {
  executionId: string
  body: string
  ids: string[]
}
interface WireRequest {
  origin: string
  path: string
  method: string
}
interface WireResponse {
  statusCode: number
  headers: Buffer[]
}
const context = new AsyncLocalStorage<Capture>()
const entries = new WeakMap<object, { id: string, started: number }>()
function headers(raw: Buffer[]) {
  const result: { key: string, value: string }[] = []
  for (let index = 0; index < raw.length; index += 2)
    result.push({ key: String(raw[index]), value: String(raw[index + 1]) })
  return result
}
function subscribe(name: string, listener: (message: unknown) => void) {
  channel(name).subscribe((message) => {
    try {
      listener(message)
    }
    catch {
      /* Diagnostics must not fail the transport. */
    }
  })
}
// Undici publishes the actual generated headers and socket, including redirects.
subscribe('undici:request:create', (message) => {
  const capture = context.getStore()
  if (!capture)
    return
  const { request } = message as { request: WireRequest }
  const id = httpConsole.append({
    kind: 'network',
    level: 'log',
    executionId: capture.executionId,
    message: `${request.method} ${request.origin}${request.path}`,
    pending: true,
    details: {
      requestBody: ['GET', 'HEAD'].includes(request.method) ? '' : capture.body,
    },
  })
  capture.ids.push(id)
  entries.set(request, { id, started: performance.now() })
})
subscribe('undici:client:sendHeaders', (message) => {
  const {
    request,
    headers: raw,
    socket,
  } = message as {
    request: WireRequest
    headers: string
    socket: Socket & Partial<TLSSocket>
  }
  const entry = entries.get(request)
  if (!entry)
    return
  const previous = httpConsole.get(entry.id)
  const certificate = socket.getPeerCertificate?.()
  httpConsole.update(entry.id, {
    details: {
      ...previous?.details,
      requestHeaders: raw,
      network: {
        localAddress: socket.localAddress,
        localPort: socket.localPort,
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        protocol: socket.getProtocol?.() ?? 'HTTP/1.1',
        cipher: socket.getCipher?.(),
        certificate: certificate
          ? {
              subject: certificate.subject,
              issuer: certificate.issuer,
              validFrom: certificate.valid_from,
              validTo: certificate.valid_to,
              fingerprint: certificate.fingerprint256,
            }
          : undefined,
      },
    },
  })
})
subscribe('undici:request:headers', (message) => {
  const { request, response } = message as {
    request: WireRequest
    response: WireResponse
  }
  const entry = entries.get(request)
  if (!entry)
    return
  const previous = httpConsole.get(entry.id)
  httpConsole.update(entry.id, {
    status: response.statusCode,
    details: {
      ...previous?.details,
      responseHeaders: headers(response.headers),
    },
  })
})
subscribe('undici:request:trailers', (message) => {
  const entry = entries.get((message as { request: WireRequest }).request)
  if (entry) {
    httpConsole.update(entry.id, {
      pending: false,
      durationMs: Math.round(performance.now() - entry.started),
    })
  }
})
subscribe('undici:request:error', (message) => {
  const { request, error } = message as { request: WireRequest, error: Error }
  const entry = entries.get(request)
  if (!entry)
    return
  const previous = httpConsole.get(entry.id)
  httpConsole.update(entry.id, {
    pending: false,
    level: 'error',
    durationMs: Math.round(performance.now() - entry.started),
    details: { ...previous?.details, error: error.message },
  })
})
export function captureHttpNetwork<T>(capture: Capture, action: () => T): T {
  return context.run(capture, action)
}
export function finishHttpNetwork(
  id: string | undefined,
  details: Record<string, unknown>,
  durationMs: number,
) {
  if (!id)
    return
  const previous = httpConsole.get(id)
  httpConsole.update(id, {
    pending: false,
    durationMs,
    ...(details.error ? { level: 'error' as const } : {}),
    details: { ...previous?.details, ...details },
  })
}
