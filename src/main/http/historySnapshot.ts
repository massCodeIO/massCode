import type { HttpHistorySnapshot } from '../../shared/httpHistory'
import type {
  HttpExecuteResult,
  HttpHeaderEntry,
  HttpMethod,
} from '../types/http'
import { Buffer } from 'node:buffer'
import { StringDecoder } from 'node:string_decoder'
import { HTTP_HISTORY_BODY_LIMIT } from '../../shared/httpHistory'

const sensitive
  = /authorization|cookie|password|passwd|secret|token|api[-_]?key/i
const mask = '[REDACTED]'

export function createHistorySnapshot(
  request: {
    method: HttpMethod
    url: string
    headers: HttpHeaderEntry[]
    body: string
  },
  response: HttpExecuteResult,
  secrets: string[],
): HttpHistorySnapshot {
  const known = new Set(secrets.filter(Boolean))
  function collect(value: unknown) {
    if (!value || typeof value !== 'object')
      return
    const field = value as Record<string, unknown>
    if (
      typeof field.key === 'string'
      && sensitive.test(field.key)
      && typeof field.value === 'string'
      && field.value
    ) {
      known.add(field.value)
    }
    for (const [key, item] of Object.entries(value)) {
      if (sensitive.test(key) && typeof item === 'string' && item)
        known.add(item)
      else collect(item)
    }
  }
  for (const body of [request.body, response.body]) {
    try {
      collect(JSON.parse(body))
    }
    catch {
      /* Non-JSON bodies are masked by known values below. */
    }
  }
  for (const header of [...request.headers, ...response.headers]) {
    if (sensitive.test(header.key) && header.value) {
      known.add(header.value)
      if (/^Bearer /i.test(header.value))
        known.add(header.value.slice(7))
    }
  }
  const url = new URL(request.url)
  if (url.password)
    known.add(decodeURIComponent(url.password))
  if (url.username)
    known.add(decodeURIComponent(url.username))
  url.username = ''
  url.password = ''
  for (const [key, value] of url.searchParams) {
    if (sensitive.test(key)) {
      if (value)
        known.add(value)
      url.searchParams.set(key, mask)
    }
  }
  // Also recognize credential fields in form-encoded payloads.
  if (
    request.headers.some(
      h =>
        /content-type/i.test(h.key)
        && h.value.includes('application/x-www-form-urlencoded'),
    )
  ) {
    for (const [key, value] of new URLSearchParams(request.body)) {
      if (sensitive.test(key) && value)
        known.add(value)
    }
  }
  function redact(value: string) {
    for (const secret of [...known].sort((a, b) => b.length - a.length)) {
      for (const encoded of new Set([
        secret,
        encodeURIComponent(secret),
        encodeURIComponent(secret).replace(/%20/g, '+'),
        JSON.stringify(secret).slice(1, -1),
      ]))
        value = value.split(encoded).join(mask)
    }
    return value
  }
  function headers(values: HttpHeaderEntry[]) {
    return values.map(h => ({
      key: redact(h.key),
      value: sensitive.test(h.key) ? mask : redact(h.value),
    }))
  }
  function body(value: string) {
    const buffer = Buffer.from(redact(value))
    return {
      body: new StringDecoder('utf8').write(
        buffer.subarray(0, HTTP_HISTORY_BODY_LIMIT),
      ),
      truncated: buffer.length > HTTP_HISTORY_BODY_LIMIT,
    }
  }
  const responseBody = body(response.body)
  return {
    request: {
      method: request.method,
      url: redact(url.toString()),
      headers: headers(request.headers),
      ...body(request.body),
    },
    response: {
      status: response.status,
      headers: headers(response.headers),
      ...responseBody,
      bodyKind: response.bodyKind,
      truncated: response.truncated || responseBody.truncated,
      ...(response.error ? { error: redact(response.error) } : {}),
    },
  }
}
