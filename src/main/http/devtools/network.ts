import type { Socket } from 'node:net'
import type { TLSSocket } from 'node:tls'
import type { Dispatcher } from 'undici'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Buffer } from 'node:buffer'
import { channel } from 'node:diagnostics_channel'
import { Pool } from 'undici'
import { httpConsole } from './console'

const BODY_PREVIEW_LIMIT = 64 * 1024

interface Capture {
  executionId: string
  body: string
  ids: string[]
  onCreate?: (id: string) => void
}
interface WireRequest {
  origin: string
  path: string
  method: string
  body?: unknown
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
    truncated:
      Buffer.isBuffer(request.body) && request.body.length > BODY_PREVIEW_LIMIT,
    details: {
      ...(Buffer.isBuffer(request.body)
        ? bodyPreview(request.body, request.body.length, 'request')
        : { requestBody: request.body == null ? '' : capture.body }),
    },
  })
  capture.ids.push(id)
  capture.onCreate?.(id)
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
  if (previous?.details?.responseTruncated)
    return
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
    ...(details.responseTruncated ? { level: 'warn' as const } : {}),
    details: {
      ...previous?.details,
      ...details,
      ...(details.responseTruncated ? { error: undefined } : {}),
    },
  })
}

function bodyPreview(
  buffer: Buffer,
  size: number,
  prefix: 'request' | 'response',
) {
  const clipped = buffer.subarray(0, BODY_PREVIEW_LIMIT)
  let body: string
  let encoding = 'utf8'
  try {
    if (clipped.includes(0))
      throw new Error('binary')
    body = new TextDecoder('utf-8', { fatal: true }).decode(clipped, {
      stream: size > clipped.length,
    })
  }
  catch {
    encoding = 'base64'
    body = clipped.toString('base64')
  }
  return {
    [`${prefix}Body`]: body,
    [`${prefix}BodyEncoding`]: encoding,
    [`${prefix}BodyBytes`]: size,
    [`${prefix}BodyTruncated`]: size > clipped.length,
  }
}

// Runs below Agent's redirect handler, once per actual response. The public
// dispatcher interceptor preserves transport backpressure and handler context.
export const captureResponseInterceptor: Dispatcher.DispatchInterceptor
  = dispatch => (options, handler) => {
    const capture = context.getStore()
    if (!capture)
      return dispatch(options, handler)
    let id: string | undefined
    let received = 0
    let stored = 0
    const chunks: Buffer[] = []
    const finish = () => {
      if (!id)
        return
      const previous = httpConsole.get(id)
      httpConsole.update(id, {
        truncated: previous?.truncated || received > BODY_PREVIEW_LIMIT,
        details: {
          ...previous?.details,
          ...bodyPreview(Buffer.concat(chunks, stored), received, 'response'),
        },
      })
    }
    const wrapped = new Proxy(handler, {
      get(target, property) {
        if (property === 'onData') {
          return (chunk: Buffer) => {
            received += chunk.length
            const keep = Math.min(chunk.length, BODY_PREVIEW_LIMIT - stored)
            if (keep > 0) {
              chunks.push(Buffer.from(chunk.subarray(0, keep)))
              stored += keep
            }
            return target.onData?.(chunk) ?? true
          }
        }
        if (property === 'onComplete') {
          return (trailers: string[] | null) => {
            finish()
            return target.onComplete?.(trailers)
          }
        }
        if (property === 'onError') {
          return (error: Error) => {
            finish()
            return target.onError?.(error)
          }
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    return context.run(
      {
        ...capture,
        onCreate: (value) => {
          id = value
        },
      },
      () => dispatch(options, wrapped),
    )
  }

export function captureDispatcherFactory(
  origin: string | URL,
  options: object,
) {
  return new Pool(origin, options).compose(captureResponseInterceptor)
}
