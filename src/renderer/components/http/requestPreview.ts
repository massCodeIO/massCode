import type { HttpRequestDraft } from '@/composables'
import type { HttpAuth, HttpHeaderEntry } from '~/main/types/http'
import { interpolateHttpVariables } from '~/shared/httpVariables'

export type HttpRequestPreviewFormat = 'http' | 'curl'

interface HttpRequestPreviewOptions {
  variables?: Record<string, string>
}

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

function interpolateAuth(
  auth: HttpAuth,
  variables: Record<string, string>,
): HttpAuth {
  return {
    type: auth.type,
    token:
      auth.token !== undefined
        ? interpolateHttpVariables(auth.token, variables)
        : auth.token,
    username:
      auth.username !== undefined
        ? interpolateHttpVariables(auth.username, variables)
        : auth.username,
    password:
      auth.password !== undefined
        ? interpolateHttpVariables(auth.password, variables)
        : auth.password,
  }
}

function interpolateDraft(
  draft: HttpRequestDraft,
  variables: Record<string, string> | undefined,
): HttpRequestDraft {
  if (!variables || Object.keys(variables).length === 0) {
    return draft
  }

  return {
    ...draft,
    url: interpolateHttpVariables(draft.url, variables),
    headers: draft.headers.map(header => ({
      ...header,
      value: interpolateHttpVariables(header.value, variables),
    })),
    query: draft.query.map(entry => ({
      ...entry,
      value: interpolateHttpVariables(entry.value, variables),
    })),
    body:
      draft.body !== null
        ? interpolateHttpVariables(draft.body, variables)
        : draft.body,
    formData: draft.formData.map(entry => ({
      ...entry,
      value:
        entry.type === 'text'
          ? interpolateHttpVariables(entry.value, variables)
          : entry.value,
    })),
    auth: interpolateAuth(draft.auth, variables),
  }
}

export function buildHttpPreview(
  draft: HttpRequestDraft,
  options: HttpRequestPreviewOptions = {},
): string {
  const previewDraft = interpolateDraft(draft, options.variables)
  const url = buildPreviewUrl(previewDraft)
  const { host, target } = getHttpUrlParts(url)
  const headers = getPreviewHeaders(previewDraft)
  const lines = [`${previewDraft.method} ${target || '/'} HTTP/1.1`]

  if (host && !hasHeader(headers, 'host')) {
    lines.push(`Host: ${host}`)
  }

  for (const header of headers) {
    lines.push(`${header.key}: ${header.value}`)
  }

  const body = bodyLines(previewDraft)
  if (body.length > 0) {
    lines.push('', ...body)
  }

  return lines.join('\n')
}

export function buildCurlPreview(
  draft: HttpRequestDraft,
  options: HttpRequestPreviewOptions = {},
): string {
  const previewDraft = interpolateDraft(draft, options.variables)
  const url = buildPreviewUrl(previewDraft)
  const indent = '     '
  const lines = [
    `curl -X ${shellDoubleQuote(previewDraft.method)} ${shellDoubleQuote(url)}`,
  ]

  for (const header of getPreviewHeaders(previewDraft)) {
    lines.push(
      `${indent}-H ${shellSingleQuote(`${header.key}: ${header.value}`)}`,
    )
  }

  if (previewDraft.bodyType === 'multipart') {
    for (const entry of previewDraft.formData.filter(entry => entry.key)) {
      const value = entry.type === 'file' ? `@${entry.value}` : entry.value
      lines.push(`${indent}-F ${shellSingleQuote(`${entry.key}=${value}`)}`)
    }
  }
  else if (previewDraft.bodyType !== 'none' && previewDraft.body) {
    lines.push(`${indent}-d ${shellAnsiCString(previewDraft.body)}`)
  }

  const command = lines
    .map((line, index) => (index === lines.length - 1 ? line : `${line} \\`))
    .join('\n')

  return [`## ${previewDraft.name}`, command].join('\n')
}

export function buildRequestPreview(
  draft: HttpRequestDraft,
  format: HttpRequestPreviewFormat,
  options: HttpRequestPreviewOptions = {},
): string {
  return format === 'http'
    ? buildHttpPreview(draft, options)
    : buildCurlPreview(draft, options)
}
