import type {
  HttpAuth,
  HttpBodyType,
  HttpFormDataEntry,
  HttpHeaderEntry,
  HttpMethod,
  HttpQueryEntry,
} from '../../types/http'
import type { HttpImportWarning } from './types'

const SUPPORTED_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

const INVALID_NAME_CHARS = new Set([
  '<',
  '>',
  ':',
  '"',
  '/',
  '\\',
  '|',
  '?',
  '*',
])
const WINDOWS_RESERVED_NAME_RE
  = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export function addWarning(
  warnings: HttpImportWarning[],
  source: string,
  message: string,
): void {
  if (warnings.length >= 200) {
    if (
      !warnings.some(
        warning => warning.message === 'Additional warnings omitted',
      )
    ) {
      warnings.push({ message: 'Additional warnings omitted', source })
    }
    return
  }

  warnings.push({ message, source })
}

export function normalizeImportName(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value : ''
  let name = [...raw.trim()]
    .map(char =>
      INVALID_NAME_CHARS.has(char) || char.charCodeAt(0) <= 0x1F ? '-' : char,
    )
    .join('')
  name = name
    .replace(/^\.+/, '')
    .replace(/[. ]+$/g, '')
    .trim()

  if (!name || name === '.' || name === '..') {
    name = fallback
  }

  if (WINDOWS_RESERVED_NAME_RE.test(name)) {
    name = `${name} item`
  }

  return name
}

export function normalizeHttpMethod(
  value: unknown,
  source: string,
  warnings: HttpImportWarning[],
): HttpMethod | null {
  const method = typeof value === 'string' ? value.toUpperCase() : 'GET'

  if (SUPPORTED_METHODS.has(method as HttpMethod)) {
    return method as HttpMethod
  }

  addWarning(warnings, source, `Unsupported HTTP method "${method}" skipped`)
  return null
}

function decodeQueryPart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  }
  catch {
    return value
  }
}

export function splitUrlAndQuery(rawUrl: string): {
  url: string
  query: HttpQueryEntry[]
} {
  const hashIndex = rawUrl.indexOf('#')
  const withoutFragment
    = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex)
  const queryIndex = withoutFragment.indexOf('?')

  if (queryIndex === -1) {
    return { query: [], url: withoutFragment }
  }

  const url = withoutFragment.slice(0, queryIndex)
  const rawQuery = withoutFragment.slice(queryIndex + 1)
  const query = rawQuery
    .split('&')
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf('=')
      const key
        = separatorIndex === -1 ? entry : entry.slice(0, separatorIndex)
      const value
        = separatorIndex === -1 ? '' : entry.slice(separatorIndex + 1)

      return {
        key: decodeQueryPart(key),
        value: decodeQueryPart(value),
      }
    })

  return { query, url }
}

export function normalizeEntries<T extends HttpHeaderEntry | HttpQueryEntry>(
  entries: T[],
  source: string,
  warnings: HttpImportWarning[],
): T[] {
  const result: T[] = []

  for (const entry of entries) {
    const key = entry.key.trim()
    const value = entry.value ?? ''

    if (!key) {
      if (value) {
        addWarning(warnings, source, 'Skipped entry with empty key')
      }
      continue
    }

    result.push({ ...entry, key, value })
  }

  return result
}

export function resolveAuthConflict(
  headers: HttpHeaderEntry[],
  auth: HttpAuth,
  source: string,
  warnings: HttpImportWarning[],
): HttpAuth {
  if (auth.type === 'none') {
    return auth
  }

  const hasAuthorizationHeader = headers.some(
    header =>
      header.enabled !== false && header.key.toLowerCase() === 'authorization',
  )

  if (!hasAuthorizationHeader) {
    return auth
  }

  addWarning(
    warnings,
    source,
    'Authorization header kept; imported auth helper skipped',
  )
  return { type: 'none' }
}

export function createEmptyRequestParts(): {
  auth: HttpAuth
  body: string | null
  bodyType: HttpBodyType
  formData: HttpFormDataEntry[]
  headers: HttpHeaderEntry[]
  query: HttpQueryEntry[]
} {
  return {
    auth: { type: 'none' },
    body: null,
    bodyType: 'none',
    formData: [],
    headers: [],
    query: [],
  }
}
