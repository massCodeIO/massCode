export interface HttpUrlQueryItem {
  key: string
  value: string
  description?: string
  enabled?: boolean
}

export function splitUrl(url: string): {
  path: string
  query: string
  fragment: string
} {
  const hashIdx = url.indexOf('#')
  const fragment = hashIdx === -1 ? '' : url.slice(hashIdx)
  const beforeHash = hashIdx === -1 ? url : url.slice(0, hashIdx)
  const qIdx = beforeHash.indexOf('?')
  const path = qIdx === -1 ? beforeHash : beforeHash.slice(0, qIdx)
  const query = qIdx === -1 ? '' : beforeHash.slice(qIdx + 1)
  return { path, query, fragment }
}

function combineUrl(parts: {
  path: string
  query: string
  fragment: string
}): string {
  return (
    parts.path + (parts.query ? `?${parts.query}` : '') + (parts.fragment || '')
  )
}

function parseQueryString(qs: string): Array<{ key: string, value: string }> {
  if (!qs)
    return []
  return qs.split('&').map((part) => {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1)
      return { key: part, value: '' }
    return { key: part.slice(0, eqIdx), value: part.slice(eqIdx + 1) }
  })
}

function buildQueryString(query: HttpUrlQueryItem[]): string {
  const enabled = query.filter(q => q.enabled !== false && q.key)
  if (!enabled.length)
    return ''
  return enabled.map(q => `${q.key}=${q.value}`).join('&')
}

export function applyQueryToUrl(
  url: string,
  query: HttpUrlQueryItem[],
): string {
  const parts = splitUrl(url)
  return combineUrl({ ...parts, query: buildQueryString(query) })
}

export function getDisplayUrl(url: string, query: HttpUrlQueryItem[]): string {
  return query.length > 0 ? applyQueryToUrl(url, query) : url
}

export function stripQueryFromUrl(url: string): string {
  const parts = splitUrl(url)
  return combineUrl({ ...parts, query: '' })
}

export function getPersistedUrl(
  url: string,
  query: HttpUrlQueryItem[],
): string {
  return query.length > 0 ? stripQueryFromUrl(url) : url
}

export function applyUrlToQuery<T extends HttpUrlQueryItem>(
  url: string,
  existingQuery: T[],
): T[] {
  const parsed = parseQueryString(splitUrl(url).query)
  const enabledExisting = existingQuery.filter(q => q.enabled !== false)
  const disabledExisting = existingQuery.filter(q => q.enabled === false)

  const next = parsed.map((p, i) => {
    const matched = enabledExisting[i]
    return {
      key: p.key,
      value: p.value,
      description: matched?.description ?? '',
      enabled: true,
    } as T
  })

  return [...next, ...disabledExisting]
}
