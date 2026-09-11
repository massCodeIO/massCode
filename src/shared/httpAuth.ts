import type {
  HttpAuth,
  HttpHeaderEntry,
  HttpQueryEntry,
} from '../main/types/http'
import { interpolateHttpVariables } from './httpVariables'

export function applyHttpApiKey<
  T extends {
    url?: string
    auth: HttpAuth
    headers: HttpHeaderEntry[]
    query: HttpQueryEntry[]
  },
>(request: T, variables: Record<string, string> = {}): T {
  if (request.auth.type !== 'apikey')
    return request
  const key = interpolateHttpVariables(request.auth.key ?? '', variables)
  const value = interpolateHttpVariables(request.auth.value ?? '', variables)
  const auth = { ...request.auth, type: 'none' as const, key, value }
  if (!key)
    return { ...request, auth }
  if (request.auth.in === 'query') {
    let query = request.query
    if (!query.length && request.url) {
      const search = request.url.split('#')[0].split('?')[1]
      if (search) {
        query = [...new URLSearchParams(search)].map(([key, value]) => ({
          key,
          value,
        }))
      }
    }
    return {
      ...request,
      auth,
      query: [...query.filter(entry => entry.key !== key), { key, value }],
    }
  }
  return {
    ...request,
    auth,
    headers: [
      ...request.headers.filter(
        entry => entry.key.toLowerCase() !== key.toLowerCase(),
      ),
      { key, value },
    ],
  }
}
