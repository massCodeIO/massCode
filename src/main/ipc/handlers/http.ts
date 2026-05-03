import type { IncomingHttpHeaders } from 'node:http'
import type { Dispatcher } from 'undici'
import type {
  HttpAuth,
  HttpBodyType,
  HttpExecutePayload,
  HttpExecuteRequest,
  HttpExecuteResult,
  HttpFormDataEntry,
  HttpHeaderEntry,
  HttpMethod,
  HttpQueryEntry,
  HttpResponseBodyKind,
} from '../../types/http'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { ipcMain } from 'electron'
import { request as undiciRequest } from 'undici'
import { interpolateHttpVariables } from '../../../shared/httpVariables'
import { useHttpStorage } from '../../storage'

const RESPONSE_BODY_CAP_BYTES = 10 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 30_000

export function interpolate(
  template: string,
  variables: Record<string, string>,
): string {
  return interpolateHttpVariables(template, variables)
}

function interpolateAuth(
  auth: HttpAuth,
  variables: Record<string, string>,
): HttpAuth {
  return {
    type: auth.type,
    token:
      auth.token !== undefined
        ? interpolate(auth.token, variables)
        : auth.token,
    username:
      auth.username !== undefined
        ? interpolate(auth.username, variables)
        : auth.username,
    password:
      auth.password !== undefined
        ? interpolate(auth.password, variables)
        : auth.password,
  }
}

function interpolateRequest(
  request: HttpExecuteRequest,
  variables: Record<string, string>,
): HttpExecuteRequest {
  return {
    method: request.method,
    url: interpolate(request.url, variables),
    headers: request.headers.map(h => ({
      ...h,
      value: interpolate(h.value, variables),
    })),
    query: request.query.map(q => ({
      ...q,
      value: interpolate(q.value, variables),
    })),
    bodyType: request.bodyType,
    body:
      request.body !== null
        ? interpolate(request.body, variables)
        : request.body,
    formData: request.formData.map(entry => ({
      key: entry.key,
      type: entry.type,
      value:
        entry.type === 'text'
          ? interpolate(entry.value, variables)
          : entry.value,
    })),
    auth: interpolateAuth(request.auth, variables),
  }
}

export function applyAuth(
  auth: HttpAuth,
  headers: HttpHeaderEntry[],
): HttpHeaderEntry[] {
  if (auth.type === 'bearer' && auth.token) {
    return [
      ...headers,
      { key: 'Authorization', value: `Bearer ${auth.token}` },
    ]
  }

  if (auth.type === 'basic' && auth.username !== undefined) {
    const credentials = Buffer.from(
      `${auth.username}:${auth.password ?? ''}`,
    ).toString('base64')
    return [
      ...headers,
      { key: 'Authorization', value: `Basic ${credentials}` },
    ]
  }

  return headers
}

function buildUrl(rawUrl: string, query: HttpQueryEntry[]): string {
  const url = new URL(rawUrl)
  if (query.length > 0) {
    url.search = ''
  }

  for (const entry of query) {
    if (entry.enabled === false)
      continue
    if (entry.key) {
      url.searchParams.append(entry.key, entry.value)
    }
  }
  return url.toString()
}

function toHeadersObject(entries: HttpHeaderEntry[]): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.enabled === false)
      continue
    if (entry.key) {
      obj[entry.key] = entry.value
    }
  }
  return obj
}

interface BuiltBody {
  body: Dispatcher.DispatchOptions['body'] | FormData
  contentType?: string
}

export function buildBody(
  bodyType: HttpBodyType,
  body: string | null,
  formData: HttpFormDataEntry[],
): BuiltBody {
  switch (bodyType) {
    case 'none':
      return { body: undefined }
    case 'json':
      return { body: body ?? '', contentType: 'application/json' }
    case 'text':
      return { body: body ?? '', contentType: 'text/plain' }
    case 'form-urlencoded':
      return {
        body: body ?? '',
        contentType: 'application/x-www-form-urlencoded',
      }
    case 'multipart': {
      const fd = new FormData()
      for (const entry of formData) {
        if (!entry.key)
          continue
        if (entry.type === 'file' && entry.value) {
          const buffer = readFileSync(entry.value)
          const blob = new Blob([buffer])
          fd.append(entry.key, blob, basename(entry.value))
        }
        else {
          fd.append(entry.key, entry.value ?? '')
        }
      }
      return { body: fd }
    }
  }
}

function detectBodyKind(contentType: string | undefined): HttpResponseBodyKind {
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('json'))
    return 'json'
  if (
    ct.startsWith('text/')
    || ct.includes('xml')
    || ct.includes('javascript')
    || ct.includes('html')
    || ct.includes('x-www-form-urlencoded')
  ) {
    return 'text'
  }
  return 'binary'
}

function toHeaderEntries(headers: IncomingHttpHeaders): HttpHeaderEntry[] {
  const entries: HttpHeaderEntry[] = []
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined)
      continue
    if (Array.isArray(value)) {
      for (const v of value) {
        entries.push({ key, value: v })
      }
    }
    else {
      entries.push({ key, value })
    }
  }
  return entries
}

function getContentType(headers: IncomingHttpHeaders): string | undefined {
  const value = headers['content-type']
  if (Array.isArray(value))
    return value[0]
  return value
}

async function readBodyCapped(
  body: NodeJS.ReadableStream,
  cap: number,
): Promise<{ buffer: Buffer, sizeBytes: number, truncated: boolean }> {
  const chunks: Buffer[] = []
  let received = 0
  let truncated = false

  for await (const chunk of body as AsyncIterable<Buffer>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    if (received + buf.length > cap) {
      const remaining = cap - received
      if (remaining > 0) {
        chunks.push(buf.subarray(0, remaining))
        received += remaining
      }
      truncated = true
      break
    }
    chunks.push(buf)
    received += buf.length
  }

  if (truncated) {
    const maybeDestroyable = body as unknown as { destroy?: () => void }
    if (typeof maybeDestroyable.destroy === 'function') {
      maybeDestroyable.destroy()
    }
  }

  return {
    buffer: Buffer.concat(chunks),
    sizeBytes: received,
    truncated,
  }
}

function resolveEnvironmentVariables(
  environmentId: number | null,
): Record<string, string> {
  if (environmentId === null)
    return {}
  const storage = useHttpStorage()
  const env = storage.environments
    .getEnvironments()
    .find(e => e.id === environmentId)
  return env?.variables ?? {}
}

async function executeHttpRequest(
  payload: HttpExecutePayload,
): Promise<HttpExecuteResult> {
  const variables = resolveEnvironmentVariables(payload.environmentId)
  const interpolated = interpolateRequest(payload.request, variables)

  const headersWithAuth = applyAuth(interpolated.auth, interpolated.headers)
  const headersObj = toHeadersObject(headersWithAuth)
  const built = buildBody(
    interpolated.bodyType,
    interpolated.body,
    interpolated.formData,
  )

  const hasContentType = Object.keys(headersObj).some(
    k => k.toLowerCase() === 'content-type',
  )
  if (!hasContentType && built.contentType) {
    headersObj['Content-Type'] = built.contentType
  }

  let finalUrl: string
  try {
    finalUrl = buildUrl(interpolated.url, interpolated.query)
  }
  catch (error) {
    return {
      status: null,
      statusText: '',
      headers: [],
      body: '',
      bodyKind: 'text',
      durationMs: 0,
      sizeBytes: 0,
      truncated: false,
      error: error instanceof Error ? error.message : 'Invalid URL',
    }
  }

  const timeoutMs = payload.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  const startedAtPerf = performance.now()

  try {
    const response = await undiciRequest(finalUrl, {
      method: interpolated.method,
      headers: headersObj,
      body: built.body as Dispatcher.DispatchOptions['body'],
      signal: controller.signal,
      maxRedirections: 5,
    })

    const { buffer, sizeBytes, truncated } = await readBodyCapped(
      response.body as unknown as NodeJS.ReadableStream,
      RESPONSE_BODY_CAP_BYTES,
    )

    const durationMs = Math.round(performance.now() - startedAtPerf)
    const headerEntries = toHeaderEntries(response.headers)
    const contentType = getContentType(response.headers)
    const bodyKind = detectBodyKind(contentType)
    const text = bodyKind === 'binary' ? '' : buffer.toString('utf-8')

    const result: HttpExecuteResult = {
      status: response.statusCode,
      statusText: '',
      headers: headerEntries,
      body: text,
      bodyKind,
      durationMs,
      sizeBytes,
      truncated,
    }

    appendHistory(
      payload,
      finalUrl,
      interpolated.method,
      response.statusCode,
      durationMs,
      sizeBytes,
      startedAt,
    )

    return result
  }
  catch (error) {
    const durationMs = Math.round(performance.now() - startedAtPerf)
    const message = error instanceof Error ? error.message : String(error)
    const isAbort = error instanceof Error && error.name === 'AbortError'

    appendHistory(
      payload,
      finalUrl,
      interpolated.method,
      null,
      durationMs,
      0,
      startedAt,
      isAbort ? `Timeout after ${timeoutMs}ms` : message,
    )

    return {
      status: null,
      statusText: '',
      headers: [],
      body: '',
      bodyKind: 'text',
      durationMs,
      sizeBytes: 0,
      truncated: false,
      error: isAbort ? `Timeout after ${timeoutMs}ms` : message,
    }
  }
  finally {
    clearTimeout(timer)
  }
}

function appendHistory(
  payload: HttpExecutePayload,
  url: string,
  method: HttpMethod,
  status: number | null,
  durationMs: number,
  sizeBytes: number,
  requestedAt: number,
  error?: string,
): void {
  try {
    const storage = useHttpStorage()
    storage.history.appendEntry({
      requestId: payload.requestId,
      method,
      url,
      status,
      durationMs,
      sizeBytes,
      requestedAt,
      ...(error ? { error } : {}),
    })
  }
  catch {
    // history is best-effort; never fail the response
  }
}

export function registerHttpHandlers(): void {
  ipcMain.handle(
    'spaces:http:execute',
    async (_, payload: HttpExecutePayload) => executeHttpRequest(payload),
  )
}
