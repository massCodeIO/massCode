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

function parseQueryString(
  qs: string,
  encodeUrl: boolean,
): Array<{ key: string, value: string }> {
  if (!qs)
    return []
  if (!encodeUrl) {
    return qs.split('&').map((part) => {
      const separator = part.indexOf('=')
      return separator < 0
        ? { key: part, value: '' }
        : { key: part.slice(0, separator), value: part.slice(separator + 1) }
    })
  }
  return [...new URLSearchParams(qs)].map(([key, value]) => ({ key, value }))
}

function encodeQueryComponent(value: string): string {
  // Keep interpolation tokens readable while escaping literal separators.
  return value
    .split(/(\{\{[^{}]*\}\})/g)
    .map(part =>
      part.startsWith('{{') && part.endsWith('}}')
        ? part
        : encodeURIComponent(part),
    )
    .join('')
}

function buildQueryString(
  query: HttpUrlQueryItem[],
  encodeUrl: boolean,
): string {
  const enabled = query.filter(q => q.enabled !== false && q.key)
  if (!enabled.length)
    return ''
  const encode = encodeUrl ? encodeQueryComponent : (value: string) => value
  return enabled.map(q => `${encode(q.key)}=${encode(q.value)}`).join('&')
}

export function applyQueryToUrl(
  url: string,
  query: HttpUrlQueryItem[],
  encodeUrl = true,
): string {
  const parts = splitUrl(url)
  return combineUrl({ ...parts, query: buildQueryString(query, encodeUrl) })
}

export function getDisplayUrl(
  url: string,
  query: HttpUrlQueryItem[],
  encodeUrl = true,
): string {
  return query.length > 0 ? applyQueryToUrl(url, query, encodeUrl) : url
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
  encodeUrl = true,
): T[] {
  const parsed = parseQueryString(splitUrl(url).query, encodeUrl)
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

/** Match the editor's URL/Params synchronization; explicit Params win. */
export function normalizeHttpDraftPatch<
  T extends { url: string, query: HttpUrlQueryItem[] },
>(
  current: T,
  patch: Partial<T>,
  encodeUrl = true,
  previousEncodeUrl = encodeUrl,
): T {
  const next = { ...current, ...patch }
  if (patch.query !== undefined)
    next.url = applyQueryToUrl(next.url, next.query, encodeUrl)
  else if (patch.url !== undefined)
    next.query = applyUrlToQuery(next.url, current.query, encodeUrl)
  if (encodeUrl !== previousEncodeUrl)
    next.url = getDisplayUrl(next.url, next.query, encodeUrl)
  return next
}
