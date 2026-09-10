import type { WebContents } from 'electron'
import {
  cookieDomainSchema,
  cookieEnabledSchema,
  cookieIdSchema,
  cookiePreviewSchema,
  cookieRequestSchema,
  cookieSaveSchema,
} from '../../../shared/httpCookies'
import { isTrustedApiRequest } from '../../api/requestIpc'
import {
  getHttpCookieJar,
  onHttpCookiesChanged,
} from '../../http/cookies/store'

export function registerHttpCookieHandlers(
  owner: WebContents,
  rendererUrl: string,
) {
  const unsubscribe = onHttpCookiesChanged(() => {
    if (!owner.isDestroyed())
      owner.send('spaces:http:cookies:event')
  })
  owner.once('destroyed', unsubscribe)
  const actions = {
    preview: (payload: unknown) => {
      const { requestId, url } = cookiePreviewSchema.parse(payload)
      const jar = getHttpCookieJar()
      if (!jar.enabled(requestId))
        return ''
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol))
          return ''
        return jar.header(url)
      }
      catch {
        return ''
      }
    },
    read: (payload: unknown) =>
      getHttpCookieJar().read(cookieRequestSchema.parse(payload).requestId),
    addDomain: (payload: unknown) =>
      getHttpCookieJar().addDomain(cookieDomainSchema.parse(payload).domain),
    save: (payload: unknown) => {
      const { domain, raw, originalId } = cookieSaveSchema.parse(payload)
      getHttpCookieJar().save(domain, raw, originalId)
    },
    remove: (payload: unknown) =>
      getHttpCookieJar().remove(cookieIdSchema.parse(payload).id),
    removeDomain: (payload: unknown) =>
      getHttpCookieJar().removeDomain(cookieDomainSchema.parse(payload).domain),
    clear: () => getHttpCookieJar().clear(),
    setEnabled: (payload: unknown) => {
      const { requestId, enabled } = cookieEnabledSchema.parse(payload)
      getHttpCookieJar().setEnabled(requestId, enabled)
    },
  }
  for (const [action, handler] of Object.entries(actions)) {
    owner.ipc.handle(
      `spaces:http:cookies:${action}`,
      (event, payload: unknown) => {
        if (!isTrustedApiRequest(event, owner, rendererUrl))
          throw new Error('Unauthorized IPC sender')
        return handler(payload)
      },
    )
  }
}
