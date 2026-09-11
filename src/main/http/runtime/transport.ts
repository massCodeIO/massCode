import type { TLSSocket } from 'node:tls'
import type { HttpTransport } from '../../../shared/httpTransport'
import { Agent, buildConnector, request } from 'undici'
import { captureDispatcherFactory } from '../devtools/network'

const dispatchers = new Map<string, Agent>()

export function getHttpDispatcher(settings: HttpTransport) {
  const version = settings.protocolVersion ?? 'http1'
  const insecure = settings.skipCertificateVerification === true
  const key = `${version}:${insecure}`
  let agent = dispatchers.get(key)
  if (!agent) {
    const options = { timeout: 0, rejectUnauthorized: !insecure }
    const connector
      = version === 'http2'
        ? buildConnector({ ...options, allowH2: true })
        : undefined
    agent = new Agent({
      factory: captureDispatcherFactory,
      allowH2: version !== 'http1',
      connect: connector
        ? (target, callback) => {
            if (target.protocol !== 'https:') {
              callback(new Error('HTTP2_HTTPS_REQUIRED'), null)
              return
            }
            connector(target, (error, socket) => {
              if (error) {
                callback(error, null)
                return
              }
              if ((socket as TLSSocket).alpnProtocol !== 'h2') {
                socket.destroy()
                callback(new Error('HTTP2_NOT_NEGOTIATED'), null)
                return
              }
              callback(null, socket)
            })
          }
        : options,
    })
    dispatchers.set(key, agent)
  }
  return agent
}

type RequestOptions = NonNullable<Parameters<typeof request>[1]>

// Built-in redirects remain the compatibility path. Advanced settings need
// per-hop control; the caller has already materialized replayable body bytes.
export async function requestWithRedirects(
  url: string,
  options: RequestOptions,
  settings: HttpTransport,
) {
  const custom
    = settings.followOriginalHttpMethod !== undefined
      || settings.followAuthorizationHeader === true
      || settings.removeRefererHeaderOnRedirect === true
      || settings.protocolVersion === 'http2'
  if (!custom)
    return request(url, options)

  let target = url
  let method = options.method
  let body = options.body
  let headers = { ...options.headers } as Record<string, string>
  const maximum = options.maxRedirections ?? 0
  for (let hop = 0; ; hop++) {
    if (
      settings.protocolVersion === 'http2'
      && new URL(target).protocol !== 'https:'
    ) {
      throw new Error('HTTP2_HTTPS_REQUIRED')
    }
    const response = await request(target, {
      ...options,
      method,
      body,
      headers,
      maxRedirections: 0,
    })
    const location = response.headers.location
    if (
      hop >= maximum
      || !location
      || ![300, 301, 302, 303, 307, 308].includes(response.statusCode)
    ) {
      return response
    }
    let next: URL
    try {
      next = new URL(Array.isArray(location) ? location[0] : location, target)
      if (!['http:', 'https:'].includes(next.protocol))
        throw new Error('HTTP_REDIRECT_PROTOCOL')
    }
    catch (error) {
      response.body.destroy()
      throw error
    }
    // Consume each intermediate response for keep-alive, cookies and console capture.
    await response.body.dump()
    const old = new URL(target)
    const rewrite
      = settings.followOriginalHttpMethod !== true
        && ((response.statusCode === 303 && method !== 'HEAD')
          || (settings.followOriginalHttpMethod === false
            && [301, 302].includes(response.statusCode)
            && method === 'POST'))
    headers = Object.fromEntries(
      Object.entries(headers).filter(([name]) => {
        const lower = name.toLowerCase()
        if (lower === 'host' || (rewrite && lower.startsWith('content-')))
          return false
        if (settings.removeRefererHeaderOnRedirect && lower === 'referer')
          return false
        if (old.origin !== next.origin) {
          if (lower === 'cookie' || lower === 'proxy-authorization')
            return false
          if (lower === 'authorization' && !settings.followAuthorizationHeader)
            return false
        }
        return true
      }),
    )
    if (rewrite) {
      method = 'GET'
      body = undefined
    }
    target = next.toString()
  }
}
