import type { HttpRequestDraft } from '@/composables'
import type { HttpAuth, HttpHeaderEntry } from '~/main/types/http'

export type HttpRequestPreviewFormat = 'http' | 'curl'

const BODY_CONTENT_TYPES: Partial<
  Record<HttpRequestDraft['bodyType'], string>
> = {
  'json': 'application/json',
  'text': 'text/plain',
  'form-urlencoded': 'application/x-www-form-urlencoded',
}

function splitUrl(url: string): {
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

function buildQueryString(query: HttpRequestDraft['query']): string {
  return query
    .filter(entry => entry.enabled !== false && entry.key)
    .map(entry => `${entry.key}=${entry.value}`)
    .join('&')
}

function buildPreviewUrl(draft: HttpRequestDraft): string {
  const queryString = buildQueryString(draft.query)

  try {
    const url = new URL(draft.url)
    if (draft.query.length > 0) {
      url.search = ''
      for (const entry of draft.query) {
        if (entry.enabled === false)
          continue
        if (entry.key) {
          url.searchParams.append(entry.key, entry.value)
        }
      }
    }
    return url.toString()
  }
  catch {
    if (!queryString) {
      return draft.url
    }

    const parts = splitUrl(draft.url)
    return (
      parts.path
      + (queryString ? `?${queryString}` : '')
      + (parts.fragment || '')
    )
  }
}

function getHttpUrlParts(url: string): { host: string, target: string } {
  try {
    const parsed = new URL(url)
    return {
      host: parsed.host,
      target: `${parsed.pathname || '/'}${parsed.search}`,
    }
  }
  catch {
    const parts = splitUrl(url)
    return {
      host: '',
      target: `${parts.path || '/'}${parts.query ? `?${parts.query}` : ''}`,
    }
  }
}

function encodeBasicCredentials(username: string, password: string): string {
  try {
    return btoa(`${username}:${password}`)
  }
  catch {
    return `${username}:${password}`
  }
}

function authHeaders(auth: HttpAuth): HttpHeaderEntry[] {
  if (auth.type === 'bearer' && auth.token) {
    return [{ key: 'Authorization', value: `Bearer ${auth.token}` }]
  }

  if (auth.type === 'basic' && auth.username !== undefined) {
    return [
      {
        key: 'Authorization',
        value: `Basic ${encodeBasicCredentials(
          auth.username,
          auth.password ?? '',
        )}`,
      },
    ]
  }

  return []
}

function hasHeader(headers: HttpHeaderEntry[], name: string): boolean {
  return headers.some(header => header.key.toLowerCase() === name)
}

function getPreviewHeaders(draft: HttpRequestDraft): HttpHeaderEntry[] {
  const headers = [
    ...draft.headers.filter(entry => entry.enabled !== false && entry.key),
    ...authHeaders(draft.auth),
  ]

  const contentType = BODY_CONTENT_TYPES[draft.bodyType]
  if (contentType && !hasHeader(headers, 'content-type')) {
    headers.push({ key: 'Content-Type', value: contentType })
  }

  return headers
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll('\'', '\'\\\'\'')}'`
}

function shellDoubleQuote(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$')
    .replaceAll('`', '\\`')}"`
}

function shellAnsiCString(value: string): string {
  return `$'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`
}

function bodyLines(draft: HttpRequestDraft): string[] {
  if (
    draft.bodyType === 'json'
    || draft.bodyType === 'text'
    || draft.bodyType === 'form-urlencoded'
  ) {
    return draft.body ? draft.body.split('\n') : []
  }

  if (draft.bodyType === 'multipart') {
    return draft.formData
      .filter(entry => entry.key)
      .map((entry) => {
        const value = entry.type === 'file' ? `@${entry.value}` : entry.value
        return `${entry.key}=${value}`
      })
  }

  return []
}

export function buildHttpPreview(draft: HttpRequestDraft): string {
  const url = buildPreviewUrl(draft)
  const { host, target } = getHttpUrlParts(url)
  const headers = getPreviewHeaders(draft)
  const lines = [`${draft.method} ${target || '/'} HTTP/1.1`]

  if (host && !hasHeader(headers, 'host')) {
    lines.push(`Host: ${host}`)
  }

  for (const header of headers) {
    lines.push(`${header.key}: ${header.value}`)
  }

  const body = bodyLines(draft)
  if (body.length > 0) {
    lines.push('', ...body)
  }

  return lines.join('\n')
}

export function buildCurlPreview(draft: HttpRequestDraft): string {
  const url = buildPreviewUrl(draft)
  const indent = '     '
  const lines = [
    `curl -X ${shellDoubleQuote(draft.method)} ${shellDoubleQuote(url)}`,
  ]

  for (const header of getPreviewHeaders(draft)) {
    lines.push(
      `${indent}-H ${shellSingleQuote(`${header.key}: ${header.value}`)}`,
    )
  }

  if (draft.bodyType === 'multipart') {
    for (const entry of draft.formData.filter(entry => entry.key)) {
      const value = entry.type === 'file' ? `@${entry.value}` : entry.value
      lines.push(`${indent}-F ${shellSingleQuote(`${entry.key}=${value}`)}`)
    }
  }
  else if (draft.bodyType !== 'none' && draft.body) {
    lines.push(`${indent}-d ${shellAnsiCString(draft.body)}`)
  }

  const command = lines
    .map((line, index) => (index === lines.length - 1 ? line : `${line} \\`))
    .join('\n')

  return [`## ${draft.name}`, command].join('\n')
}

export function buildRequestPreview(
  draft: HttpRequestDraft,
  format: HttpRequestPreviewFormat,
): string {
  return format === 'http' ? buildHttpPreview(draft) : buildCurlPreview(draft)
}
