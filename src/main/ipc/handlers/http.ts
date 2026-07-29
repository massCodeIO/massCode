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
  HttpSecretMutationResult,
  HttpSecretPayload,
  HttpSecretSetPayload,
} from '../../types/http'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { ipcMain } from 'electron'
import { Agent, request as undiciRequest } from 'undici'
import {
  HTTP_SECRET_MASK,
  interpolateHttpVariables,
  maskHttpSecretVariables,
} from '../../../shared/httpVariables'
import {
  deleteEnvironmentSecret,
  getEnvironmentSecrets,
  isSecretsEncryptionAvailable,
  revealEnvironmentSecret,
  setEnvironmentSecret,
} from '../../http/secrets'
import { useHttpStorage } from '../../storage'

const RESPONSE_BODY_CAP_BYTES = 10 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 30_000
const insecureCertificateDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
})

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

function getNestedCause(error: unknown): Record<string, unknown> | null {
  return asRecord(asRecord(error)?.cause)
}

function collectErrorCandidates(
  error: unknown,
  seen = new Set<unknown>(),
): unknown[] {
  const record = asRecord(error)
  if (!record || seen.has(error))
    return [error]

  seen.add(error)

  const candidates = [error]
  const cause = record.cause
  if (cause !== undefined) {
    candidates.push(...collectErrorCandidates(cause, seen))
  }

  if (Array.isArray(record.errors)) {
    for (const nested of record.errors) {
      candidates.push(...collectErrorCandidates(nested, seen))
    }
  }

  return candidates
}

function formatHostPort(source: Record<string, unknown>): string | undefined {
  const address = stringValue(source.address)
  const port = numberValue(source.port)
  if (!address)
    return undefined
  return port === undefined ? address : `${address}:${port}`
}

function formatDetailedRequestError(source: unknown): string | undefined {
  const record = asRecord(source)
  if (!record)
    return undefined

  const code = stringValue(record.code)
  const syscall = stringValue(record.syscall)
  const hostPort = formatHostPort(record)

  if (code && hostPort)
    return [syscall, code, hostPort].filter(Boolean).join(' ')

  return undefined
}

function getErrorMessage(error: unknown): string | undefined {
  return stringValue(asRecord(error)?.message)
}

export function formatHttpRequestError(error: unknown): string {
  const candidates = collectErrorCandidates(error)
  const detailedCandidates = candidates
    .map(candidate => ({
      message: formatDetailedRequestError(candidate),
      record: asRecord(candidate),
    }))
    .filter(candidate => candidate.message)

  const ipv4Detailed = detailedCandidates.find((candidate) => {
    return stringValue(candidate.record?.address)?.includes('.') === true
  })

  if (ipv4Detailed?.message)
    return ipv4Detailed.message

  if (detailedCandidates[0]?.message)
    return detailedCandidates[0].message

  const causeMessage = getErrorMessage(getNestedCause(error))
  if (causeMessage && causeMessage !== 'AggregateError')
    return causeMessage

  const nestedMessage = candidates
    .slice(1)
    .map(candidate => getErrorMessage(candidate))
    .find(message => message && message !== 'AggregateError')

  if (nestedMessage)
    return nestedMessage

  if (error instanceof Error && error.message)
    return error.message

  return String(error)
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

interface ResolvedEnvironment {
  variables: Record<string, string>
  /**
   * Те же переменные, но со значениями секретов, замененными на маску. История
   * запросов живёт в .state.yaml внутри vault, поэтому URL для неё строится
   * из этой карты, а не маскируется постфактум: `buildUrl` percent-кодирует
   * значения, и поиск исходной подстроки в готовом URL находил бы не всё.
   */
  maskedVariables: Record<string, string>
  /**
   * Фактические непустые значения секретов. Нужны там, где маскировать через
   * карту переменных нельзя: текст ошибки приходит из сети (например
   * `getaddrinfo ENOTFOUND <хост>`) и может содержать значение секрета.
   */
  secretValues: string[]
}

/**
 * Убирает значения секретов из текста, который будет записан в vault.
 * Значения сортируются по убыванию длины, чтобы более короткий секрет,
 * являющийся подстрокой более длинного, не ломал замену.
 */
function maskSecretValues(text: string, secretValues: string[]): string {
  let result = text
  for (const value of [...secretValues].sort((a, b) => b.length - a.length)) {
    result = result.split(value).join(HTTP_SECRET_MASK)
    const encoded = encodeURIComponent(value)
    // `URLSearchParams` кодирует пробел как `+`, а не `%20`, поэтому в query
    // значение может выглядеть иначе, чем после `encodeURIComponent`.
    for (const candidate of [encoded, encoded.replace(/%20/g, '+')]) {
      if (candidate !== value) {
        result = result.split(candidate).join(HTTP_SECRET_MASK)
      }
    }
  }
  return result
}

export function resolveEnvironment(
  environmentId: number | null,
): ResolvedEnvironment {
  if (environmentId === null)
    return { maskedVariables: {}, secretValues: [], variables: {} }

  const storage = useHttpStorage()
  const env = storage.environments
    .getEnvironments()
    .find(e => e.id === environmentId)

  if (!env)
    return { maskedVariables: {}, secretValues: [], variables: {} }

  const secretKeys = env.secretKeys ?? []
  const secrets = getEnvironmentSecrets(environmentId)
  const variables: Record<string, string> = { ...env.variables }

  // Секрет, объявленный в vault, но не заданный на этом устройстве, должен
  // подставиться пустой строкой, а не остаться литералом `{{KEY}}` в запросе.
  for (const key of secretKeys) {
    variables[key] = secrets[key] ?? ''
  }

  return {
    maskedVariables: maskHttpSecretVariables(variables, secretKeys),
    secretValues: secretKeys
      .map(key => variables[key])
      .filter(value => Boolean(value)),
    variables,
  }
}

async function executeHttpRequest(
  payload: HttpExecutePayload,
): Promise<HttpExecuteResult> {
  const { maskedVariables, secretValues, variables } = resolveEnvironment(
    payload.environmentId,
  )
  const interpolated = interpolateRequest(payload.request, variables)

  // URL для истории строится по той же схеме, но из маскированных значений:
  // в vault не должно попасть ни сырое, ни percent-encoded значение секрета.
  function buildHistoryUrl(): string {
    try {
      const masked = interpolateRequest(payload.request, maskedVariables)
      return buildUrl(masked.url, masked.query)
    }
    catch {
      // Не подставляем сюда собранный URL: он содержит значения секретов.
      return payload.request.url
    }
  }

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
      ...(payload.skipCertificateVerification
        ? { dispatcher: insecureCertificateDispatcher }
        : {}),
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
      buildHistoryUrl(),
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
    const message = formatHttpRequestError(error)
    const isAbort = error instanceof Error && error.name === 'AbortError'

    const historyUrl = buildHistoryUrl()
    // Маскируем только копию для истории: она уходит в vault, который
    // синхронизируется через облако. `error` в ответе остаётся сырым, потому
    // что renderer показывает его локально и пользователю нужен точный текст.
    // Сообщение undici может содержать собранный URL целиком, а также голое
    // значение секрета (например `getaddrinfo ENOTFOUND <секретный-хост>`).
    const historyError = maskSecretValues(
      message.split(finalUrl).join(historyUrl),
      secretValues,
    )

    appendHistory(
      payload,
      historyUrl,
      interpolated.method,
      null,
      durationMs,
      0,
      startedAt,
      isAbort ? `Timeout after ${timeoutMs}ms` : historyError,
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

/**
 * Значения секретов ходят только через IPC: локальный HTTP API слушает все
 * интерфейсы с открытым CORS, и отдавать через него расшифрованные секреты
 * означало бы обойти защиту OS keychain.
 */
function setEnvironmentSecretHandler(
  payload: HttpSecretSetPayload,
): HttpSecretMutationResult {
  const key = payload.key.trim()
  if (!key) {
    return { error: 'invalidKey', ok: false }
  }

  if (!isSecretsEncryptionAvailable()) {
    return { error: 'unavailable', ok: false }
  }

  const storage = useHttpStorage()
  try {
    // Сначала сохраняем зашифрованное значение локально и только потом удаляем
    // plain-значение из vault (`addSecretKey` делает и то, и другое). Обратный
    // порядок терял бы значение полностью при сбое шифрования.
    setEnvironmentSecret(payload.environmentId, key, payload.value)

    const { notFound } = storage.environments.addSecretKey(
      payload.environmentId,
      key,
    )
    if (notFound) {
      // Окружение исчезло между вызовами: локальный секрет теперь ничей.
      deleteEnvironmentSecret(payload.environmentId, key)
      return { error: 'notFound', ok: false }
    }

    return { ok: true }
  }
  catch {
    // `addSecretKey` мог упасть (например vault в состоянии гидрации) уже после
    // успешного шифрования: без компенсации локальное значение осталось бы без
    // ключа в `secretKeys` — невидимым и неудаляемым. Удаление безопасно, это
    // значение записал сам этот вызов.
    deleteEnvironmentSecret(payload.environmentId, key)
    return { error: 'unknown', ok: false }
  }
}

function deleteEnvironmentSecretHandler(
  payload: HttpSecretPayload,
): HttpSecretMutationResult {
  const key = payload.key.trim()
  const storage = useHttpStorage()

  try {
    const { notFound } = storage.environments.removeSecretKey(
      payload.environmentId,
      key,
    )
    if (notFound) {
      return { error: 'notFound', ok: false }
    }

    deleteEnvironmentSecret(payload.environmentId, key)
    return { ok: true }
  }
  catch {
    return { error: 'unknown', ok: false }
  }
}

export function registerHttpHandlers(): void {
  ipcMain.handle(
    'spaces:http:execute',
    async (_, payload: HttpExecutePayload) => executeHttpRequest(payload),
  )

  ipcMain.handle('spaces:http:secrets-status', () => ({
    available: isSecretsEncryptionAvailable(),
  }))

  ipcMain.handle('spaces:http:set-secret', (_, payload: HttpSecretSetPayload) =>
    setEnvironmentSecretHandler(payload))

  ipcMain.handle('spaces:http:delete-secret', (_, payload: HttpSecretPayload) =>
    deleteEnvironmentSecretHandler(payload))

  ipcMain.handle('spaces:http:reveal-secret', (_, payload: HttpSecretPayload) =>
    revealEnvironmentSecret(payload.environmentId, payload.key.trim()))
}
