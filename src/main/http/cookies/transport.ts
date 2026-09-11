import type { Buffer } from 'node:buffer'
import type { Dispatcher } from 'undici'
import type { HttpCookieJar } from './jar'
import { AsyncLocalStorage } from 'node:async_hooks'

const context = new AsyncLocalStorage<HttpCookieJar | undefined>()
export function withHttpCookies<T>(
  jar: HttpCookieJar | undefined,
  run: () => T,
): T {
  return context.run(jar, run)
}
// Composed below Agent redirects: every hop gets cookies for its own URL.
export const cookieInterceptor: Dispatcher.DispatchInterceptor
  = dispatch => (options, handler) => {
    const jar = context.getStore()
    if (!jar)
      return dispatch(options, handler)
    const url = new URL(options.path, options.origin).toString()
    const rawHeaders = options.headers
    const entries = Array.isArray(rawHeaders)
      ? Array.from({ length: rawHeaders.length / 2 }, (_, i) => [
          rawHeaders[i * 2],
          rawHeaders[i * 2 + 1],
        ])
      : rawHeaders && Symbol.iterator in rawHeaders
        ? [...(rawHeaders as Iterable<[string, string | string[] | undefined]>)]
        : Object.entries(rawHeaders ?? {})
    const manual = entries
      .filter(([key]) => String(key).toLowerCase() === 'cookie')
      .map(([, value]) => String(value))
      .join('; ')
    const headers = entries
      .filter(([key]) => String(key).toLowerCase() !== 'cookie')
      .flatMap(([key, value]) => [String(key), String(value)])
    const cookie = jar.header(url, manual)
    if (cookie)
      headers.push('cookie', cookie)
    const wrapped = new Proxy(handler, {
      get(target, property) {
        if (property === 'onHeaders') {
          return (
            status: number,
            raw: Buffer[],
            resume: () => void,
            statusText: string,
          ) => {
            const values: string[] = []
            for (let i = 0; i < raw.length; i += 2) {
              if (String(raw[i]).toLowerCase() === 'set-cookie')
                values.push(String(raw[i + 1]))
            }
            jar.receive(url, values)
            return target.onHeaders?.(status, raw, resume, statusText)
          }
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    return dispatch({ ...options, headers }, wrapped)
  }
