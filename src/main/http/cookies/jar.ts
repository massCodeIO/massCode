import type { SerializedCookieJar } from 'tough-cookie'
import type { HttpCookie } from '../../../shared/httpCookies'
import { Cookie, CookieJar } from 'tough-cookie'

export interface CookieState {
  jar?: SerializedCookieJar
  domains: string[]
  disabledRequests: number[]
}
export function normalizeCookieDomain(input: string) {
  const url = new URL(input.includes('://') ? input : `http://${input}`)
  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || !url.hostname
  ) {
    throw new Error('invalidDomain')
  }
  return url.hostname.replace(/^\./, '').toLowerCase()
}
function cookieId(cookie: Cookie) {
  return JSON.stringify([cookie.domain, cookie.path, cookie.key])
}
export class HttpCookieJar {
  private jar: CookieJar
  private domains: Set<string>
  private disabled: Set<number>
  constructor(
    state: CookieState = { domains: [], disabledRequests: [] },
    private persist: (state: CookieState) => void = () => {},
  ) {
    this.jar = state.jar
      ? CookieJar.deserializeSync(state.jar)
      : new CookieJar(undefined, {
        prefixSecurity: 'unsafe-disabled',
        allowSecureOnLocal: false,
      })
    this.domains = new Set(state.domains)
    this.disabled = new Set(state.disabledRequests)
  }

  private liveCookies() {
    return (this.jar.serializeSync()!.cookies ?? [])
      .map(value => Cookie.fromJSON(value))
      .filter(
        (cookie): cookie is Cookie =>
          Boolean(cookie) && (cookie!.expiryTime() ?? Infinity) > Date.now(),
      )
  }

  private changed() {
    this.persist({
      jar: this.jar.serializeSync(),
      domains: [...this.domains],
      disabledRequests: [...this.disabled],
    })
  }

  read(requestId: number | null) {
    const cookies: HttpCookie[] = this.liveCookies().map(cookie => ({
      id: cookieId(cookie),
      domain: cookie.domain!,
      name: cookie.key,
      value: cookie.value,
      path: cookie.path!,
      raw: cookie.toString(),
      expires: Number.isFinite(cookie.expiryTime())
        ? new Date(cookie.expiryTime()!).toISOString()
        : null,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      hostOnly: cookie.hostOnly ?? false,
    }))
    return {
      domains: [
        ...new Set([
          ...this.domains,
          ...cookies.map(cookie => cookie.domain),
        ]),
      ].sort(),
      cookies,
      enabled: this.enabled(requestId),
    }
  }

  enabled(requestId: number | null) {
    return requestId === null || !this.disabled.has(requestId)
  }

  setEnabled(requestId: number | null, enabled: boolean) {
    if (requestId === null)
      throw new Error('requestRequired')
    if (enabled)
      this.disabled.delete(requestId)
    else this.disabled.add(requestId)
    this.changed()
  }

  addDomain(input: string) {
    const domain = normalizeCookieDomain(input)
    this.domains.add(domain)
    this.changed()
    return domain
  }

  save(domainInput: string, raw: string, originalId?: string) {
    const domain = normalizeCookieDomain(domainInput)
    const cookie = Cookie.parse(raw)
    const validation = cookie?.clone()
    if (validation) {
      // Empty values and non-positive Max-Age are valid deletion/update flows.
      validation.value ||= 'value'
      if (validation.maxAge !== null && Number(validation.maxAge) <= 0)
        validation.maxAge = null
    }
    if (!cookie || !cookie.key || !validation?.validate())
      throw new Error('invalidCookie')
    // Validate before removing the original; invalid edits must never lose data.
    const candidate = this.jar.cloneSync()!
    candidate.setCookieSync(cookie, `https://${domain}/`)
    if (originalId) {
      const original = this.liveCookies().find(
        item => cookieId(item) === originalId,
      )
      if (original && cookieId(original) !== cookieId(cookie)) {
        candidate.store.removeCookie(
          original.domain!,
          original.path!,
          original.key,
          () => {},
        )
      }
    }
    this.jar = candidate
    this.domains.add(domain)
    this.changed()
  }

  remove(id: string) {
    const cookie = this.liveCookies().find(item => cookieId(item) === id)
    if (cookie) {
      this.jar.store.removeCookie(
        cookie.domain!,
        cookie.path!,
        cookie.key,
        () => {},
      )
    }
    this.changed()
  }

  removeDomain(input: string) {
    const domain = normalizeCookieDomain(input)
    for (const cookie of this.liveCookies()) {
      if (cookie.domain === domain) {
        this.jar.store.removeCookie(
          cookie.domain,
          cookie.path!,
          cookie.key,
          () => {},
        )
      }
    }
    this.domains.delete(domain)
    this.changed()
  }

  clear() {
    this.jar.removeAllCookiesSync()
    this.domains.clear()
    this.changed()
  }

  header(url: string, manual = '') {
    // tough-cookie updates lastAccessed when reading and uses it for Max-Age.
    // Read a copy so requests cannot extend the stored cookie's lifetime.
    const automatic = this.jar.cloneSync()!.getCookieStringSync(url)
    return [automatic, manual].filter(Boolean).join('; ')
  }

  receive(url: string, headers: string[]) {
    let changed = false
    for (const raw of headers) {
      try {
        const cookie = this.jar.setCookieSync(raw, url)
        if (cookie) {
          this.domains.add(cookie.domain!)
          changed = true
        }
      }
      catch {
        /* Invalid server cookies are ignored, without failing the response. */
      }
    }
    if (changed)
      this.changed()
  }
}
