import type { HttpRequestDraft } from '@/composables'
import type { HarRequest } from 'httpsnippet'
import type { HttpAuth, HttpHeaderEntry } from '~/main/types/http'
import { buildGraphqlBody } from '~/shared/httpGraphql'
import { interpolateHttpVariables } from '~/shared/httpVariables'

export type { HttpRequestPreviewFormat } from '~/shared/httpPreview'
type HttpRequestPreviewFormat = 'http' | 'curl' | 'fetch' | 'axios'

interface HttpRequestPreviewOptions {
  name?: string
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

function restoreUrlVariables(url: string): string {
  return url.replace(/%7B%7B(?:[\w.-]|%20|%09)+%7D%7D/gi, match =>
    decodeURIComponent(match))
}

function buildQueryString(query: HttpRequestDraft['query']): string {
  return query
    .filter(entry => entry.enabled !== false && entry.key)
    .map(
      entry =>
        `${restoreUrlVariables(encodeURIComponent(entry.key))}=${restoreUrlVariables(encodeURIComponent(entry.value))}`,
    )
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
    return restoreUrlVariables(url.toString())
  }
  catch {
    if (draft.query.length === 0) {
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
      target: restoreUrlVariables(`${parsed.pathname || '/'}${parsed.search}`),
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
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
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
  if (draft.bodyType === 'graphql') {
    if (draft.method !== 'POST')
      throw new Error('GRAPHQL_METHOD')
    draft = {
      ...draft,
      method: 'POST',
      bodyType: 'json',
      body: buildGraphqlBody(draft.body, variables),
      headers: [...draft.headers],
    }
    if (
      !draft.headers.some(
        header =>
          header.enabled !== false && header.key.toLowerCase() === 'accept',
      )
    ) {
      draft.headers.push({
        key: 'Accept',
        value: 'application/graphql-response+json, application/json;q=0.9',
      })
    }
    // Already interpolated before JSON encoding. Do not interpolate this body twice.
    return {
      ...interpolateDraft({ ...draft, body: null }, variables),
      body: draft.body,
    }
  }
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

  for (const header of getPreviewHeaders(previewDraft).filter(
    header =>
      previewDraft.bodyType !== 'multipart'
      || header.key.toLowerCase() !== 'content-type',
  )) {
    lines.push(
      `${indent}-H ${shellSingleQuote(`${header.key}: ${header.value}`)}`,
    )
  }

  if (previewDraft.bodyType === 'multipart') {
    for (const entry of previewDraft.formData.filter(entry => entry.key)) {
      if (entry.type === 'file') {
        const path = entry.value
          .replaceAll('\\', '\\\\')
          .replaceAll('"', '\\"')
        lines.push(
          `${indent}-F ${shellSingleQuote(`${entry.key}=@"${path}"`)}`,
        )
      }
      else {
        lines.push(
          `${indent}--form-string ${shellSingleQuote(`${entry.key}=${entry.value}`)}`,
        )
      }
    }
  }
  else if (previewDraft.bodyType !== 'none' && previewDraft.body) {
    lines.push(`${indent}--data-raw ${shellAnsiCString(previewDraft.body)}`)
  }

  const command = lines
    .map((line, index) => (index === lines.length - 1 ? line : `${line} \\`))
    .join('\n')

  return options.name
    ? [
        ...options.name.split(/\r?\n/).map(line => `## ${line}`),
        command,
      ].join('\n')
    : command
}

export function buildRequestPreview(
  draft: HttpRequestDraft,
  format: HttpRequestPreviewFormat,
  options: HttpRequestPreviewOptions = {},
): string {
  if (format === 'http')
    return buildHttpPreview(draft, options)
  if (format === 'curl')
    return buildCurlPreview(draft, options)
  return buildJavaScriptPreview(draft, format, options)
}

export function getRequestPreviewWarnings(
  draft: HttpRequestDraft,
  format: import('~/shared/httpPreview').HttpRequestPreviewFormat,
): ('multipartFiles' | 'fetchBody' | 'multipartContentType')[] {
  if (format !== 'fetch' && format !== 'axios' && format !== 'node:fetch')
    return []
  const warnings: ('multipartFiles' | 'fetchBody' | 'multipartContentType')[]
    = []
  if (draft.bodyType === 'multipart' && format !== 'node:fetch') {
    if (draft.formData.some(entry => entry.key && entry.type === 'file'))
      warnings.push('multipartFiles')
    if (
      draft.headers.some(
        entry =>
          entry.enabled !== false && entry.key.toLowerCase() === 'content-type',
      )
    ) {
      warnings.push('multipartContentType')
    }
  }
  if (
    (format === 'fetch' || format === 'node:fetch')
    && (draft.method === 'GET' || draft.method === 'HEAD')
    && draft.bodyType !== 'none'
  ) {
    warnings.push('fetchBody')
  }
  return warnings
}

export function buildHarRequest(
  draft: HttpRequestDraft,
  options: HttpRequestPreviewOptions = {},
): HarRequest {
  const preview = interpolateDraft(draft, options.variables)
  const headers = getPreviewHeaders(preview)
  const contentType = headers.find(
    header => header.key.toLowerCase() === 'content-type',
  )?.value
  const postData: HarRequest['postData'] = {
    mimeType: contentType ?? 'application/octet-stream',
  }
  if (preview.bodyType === 'multipart') {
    postData.mimeType = 'multipart/form-data'
    postData.params = preview.formData
      .filter(entry => entry.key)
      .map(entry => ({
        name: entry.key,
        ...(entry.type === 'file'
          ? { fileName: entry.value }
          : { value: entry.value }),
      }))
  }
  else if (preview.bodyType !== 'none' && preview.body !== null) {
    postData.text = preview.body
    if (preview.bodyType === 'form-urlencoded') {
      postData.params = [...new URLSearchParams(preview.body)].map(
        ([name, value]) => ({ name, value }),
      )
    }
  }
  return {
    method: preview.method,
    url: buildPreviewUrl(preview),
    httpVersion: 'HTTP/1.1',
    headers: headers
      .filter(
        header =>
          preview.bodyType !== 'multipart'
          || header.key.toLowerCase() !== 'content-type',
      )
      .map(({ key, value }) => ({ name: key, value })),
    queryString: [],
    cookies: [],
    headersSize: -1,
    bodySize: -1,
    postData,
  }
}

export function buildJavaScriptPreview(
  draft: HttpRequestDraft,
  format: 'fetch' | 'axios',
  options: HttpRequestPreviewOptions = {},
): string {
  const previewDraft = interpolateDraft(draft, options.variables)
  const multipart = previewDraft.bodyType === 'multipart'
  const headers = new Map<string, { key: string, value: string }>()
  for (const header of getPreviewHeaders(previewDraft)) {
    const key = header.key.toLowerCase()
    // FormData owns the boundary; a copied content type would invalidate it.
    if (multipart && key === 'content-type')
      continue
    headers.set(key, header)
  }
  const headerObject = Object.fromEntries(
    [...headers.values()].map(({ key, value }) => [key, value]),
  )
  const lines: string[] = []
  const files: string[] = []
  if (multipart) {
    lines.push('const body = new FormData();')
    for (const entry of previewDraft.formData.filter(entry => entry.key)) {
      let value = JSON.stringify(entry.value)
      if (entry.type === 'file') {
        value = `file${files.length + 1}`
        files.push(value)
      }
      lines.push(`body.append(${JSON.stringify(entry.key)}, ${value});`)
    }
    lines.push('')
  }
  const config: Record<string, unknown> = {
    ...(format === 'axios' ? { url: buildPreviewUrl(previewDraft) } : {}),
    method: previewDraft.method,
    headers: headerObject,
  }
  const serialized = JSON.stringify(config, null, 2).split('\n')
  if (previewDraft.bodyType !== 'none' && (multipart || previewDraft.body)) {
    serialized[serialized.length - 2] += ','
    serialized.splice(
      serialized.length - 1,
      0,
      `  "${format === 'fetch' ? 'body' : 'data'}": ${multipart ? 'body' : JSON.stringify(previewDraft.body)}`,
    )
  }
  const call
    = format === 'fetch'
      ? `fetch(${JSON.stringify(buildPreviewUrl(previewDraft))}, ${serialized.join('\n')})`
      : `axios(${serialized.join('\n')})`
  lines.push(`const response = await ${call};`)
  const imports = format === 'axios' ? 'import axios from "axios";\n\n' : ''
  if (files.length) {
    lines.push('return response;')
    return `${imports}async function sendRequest(${files.join(', ')}) {\n${lines
      .join('\n')
      .split('\n')
      .map(line => (line ? `  ${line}` : ''))
      .join('\n')}\n}`
  }
  return imports + lines.join('\n')
}
