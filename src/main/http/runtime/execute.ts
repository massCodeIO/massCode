import type { IncomingHttpHeaders } from 'node:http'
import type { Dispatcher } from 'undici'
import type { HttpHistorySnapshot } from '../../../shared/httpHistory'
import type { HttpScriptResult } from '../../../shared/httpScripts'
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
import type { ResolvedHttpCollection } from '../collection'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { Agent, request as undiciRequest } from 'undici'
import { applyHttpApiKey } from '../../../shared/httpAuth'
import {
  applyHttpCollection,
  collectionVariables,
  mergeHttpCollectionRuntime,
} from '../../../shared/httpCollection'
import { buildHttpFormBody } from '../../../shared/httpForm'
import {
  buildGraphqlBody,
  graphqlResponseState,
} from '../../../shared/httpGraphql'
import {
  emptyHttpRuntime,
  httpRuntimeSchema,
} from '../../../shared/httpRuntime'
import { hasHttpScripts } from '../../../shared/httpScripts'
import {
  HTTP_SECRET_MASK,
  interpolateHttpVariables,
  maskHttpSecretVariables,
} from '../../../shared/httpVariables'
import { useHttpStorage } from '../../storage'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { resolveHttpCollection } from '../collection'
import { getHttpCookieJar } from '../cookies/store'
import { withHttpCookies } from '../cookies/transport'
import { httpConsole } from '../devtools/console'
import {
  captureDispatcherFactory,
  captureHttpNetwork,
  finishHttpNetwork,
} from '../devtools/network'
import { createHistorySnapshot } from '../historySnapshot'
import { executeScript } from '../scripts/execute'
import { scriptsTrusted } from '../scripts/trust'
import { getEnvironmentSecrets } from '../secrets'
import { evaluateHttpRuntime } from './evaluate'
import {
  commitHttpSession,
  getHttpSession,
  isHttpSessionCurrent,
} from './session'
import { variableScopeLimit } from './variables'

const RESPONSE_BODY_CAP_BYTES = 10 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 30_000
const certificateDispatcher = new Agent({
  factory: captureDispatcherFactory,
})
const insecureCertificateDispatcher = new Agent({
  factory: captureDispatcherFactory,
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
    ...auth,
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
  request = applyHttpApiKey(request, variables)
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
      request.bodyType === 'form-urlencoded'
        ? buildHttpFormBody(request.body, request.formData, variables)
        : request.body !== null
          && request.bodyType !== 'graphql'
          && request.bodyType !== 'binary'
          ? interpolate(request.body, variables)
          : request.body,
    formData: request.formData
      .filter(entry => entry.enabled !== false)
      .map(entry => ({
        ...entry,
        key: interpolate(entry.key, variables),
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

function readBodyFile(path: string) {
  try {
    return readFileSync(path)
  }
  catch {
    throw new Error('HTTP_BODY_FILE_UNAVAILABLE')
  }
}

export function buildBody(
  bodyType: HttpBodyType,
  body: string | null,
  formData: HttpFormDataEntry[],
): BuiltBody {
  switch (bodyType) {
    case 'binary':
      return {
        body: readBodyFile(body ?? ''),
        contentType: 'application/octet-stream',
      }
    case 'none':
      return { body: undefined }
    case 'graphql':
      return { body: body ?? '', contentType: 'application/json' }
    case 'json':
      return { body: body ?? '', contentType: 'application/json' }
    case 'text':
      return { body: body ?? '', contentType: 'text/plain' }
    case 'form-urlencoded':
      return {
        body: buildHttpFormBody(body, formData),
        contentType: 'application/x-www-form-urlencoded',
      }
    case 'multipart': {
      const fd = new FormData()
      for (const entry of formData) {
        if (!entry.key || entry.enabled === false)
          continue
        if (entry.type === 'file' && entry.value) {
          const buffer = readBodyFile(entry.value)
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

export interface ResolvedEnvironment {
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
  const scopeId = env.secretStorageId ?? String(env.id)
  const secrets = getEnvironmentSecrets(scopeId)
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

export interface HttpRunContext {
  collection?: ResolvedHttpCollection | null
  environment: ResolvedEnvironment
  variables: Record<string, string>
  signal: AbortSignal
  isCurrent: () => boolean
}

export async function executeHttpRequest(
  payload: HttpExecutePayload,
  run?: HttpRunContext,
  signal?: AbortSignal,
): Promise<HttpExecuteResult> {
  const executionId = randomUUID()
  const networkIds: string[] = []
  const vaultPath = getVaultPath()
  const storage = useHttpStorage()
  const saved
    = run || payload.requestId === null
      ? null
      : storage.requests.getRequestById(payload.requestId)
  if (
    !run
    && payload.requestId !== null
    && (!saved || saved.pendingCloudDownload || saved.runtimeState !== 'ready')
  ) {
    throw new Error('HTTP_RUNTIME_UNAVAILABLE')
  }
  if (storage.environments.getActiveEnvironmentId() !== payload.environmentId)
    throw new Error('HTTP_CONTEXT_CHANGED')
  // Execute an isolated draft without persisting it. Older callers may omit it.
  const requestRuntime = httpRuntimeSchema.parse(
    payload.runtime === undefined
      ? (saved?.runtime ?? emptyHttpRuntime())
      : payload.runtime,
  )
  const collection = run
    ? run.collection
    : resolveHttpCollection(saved?.folderId)
  const config = collection?.config
  const runtime = mergeHttpCollectionRuntime(requestRuntime, config?.runtime)
  payload = {
    ...payload,
    request: applyHttpCollection(payload.request, config),
  }
  const session = run
    ? {
        generation: -1,
        variables: { ...run.variables },
        names: Object.keys(run.variables),
      }
    : getHttpSession(vaultPath, payload.environmentId)
  signal ??= run?.signal
  const current = () =>
    !signal?.aborted
    && (run
      ? !run.signal.aborted && run.isCurrent()
      : isHttpSessionCurrent(session.generation))
    && getVaultPath() === vaultPath
    && storage.environments.getActiveEnvironmentId() === payload.environmentId
  const sessionSecrets = Object.values(session.variables).filter(Boolean)
  const environment = run
    ? structuredClone(run.environment)
    : resolveEnvironment(payload.environmentId)
  const variables = {
    ...collectionVariables(config),
    ...environment.variables,
  }
  const maskedVariables = {
    ...collectionVariables(config),
    ...environment.maskedVariables,
  }
  const secretValues = environment.secretValues
  const commitValues = (values: Map<string, string | null>) => {
    if (!run) {
      commitHttpSession(session.generation, values)
      return getHttpSession(vaultPath, payload.environmentId).names
    }
    for (const [name, value] of values) {
      if (value === null)
        delete run.variables[name]
      else run.variables[name] = value
    }
    return []
  }
  Object.assign(variables, session.variables)
  Object.assign(
    maskedVariables,
    maskHttpSecretVariables(session.variables, session.names),
  )
  secretValues.push(...sessionSecrets)
  let interpolated = interpolateRequest(payload.request, variables)
  const subjects = [
    ...(collection?.scopes ?? [{ id: collection?.id ?? null, config }]).map(
      scope => ({
        source: 'collection' as const,
        id: scope.id,
        scripts: scope.config?.runtime.scripts,
      }),
    ),
    {
      source: 'request' as const,
      id: payload.requestId,
      scripts: requestRuntime.scripts,
    },
  ]
  const scripted = subjects.some(subject => hasHttpScripts(subject.scripts))
  const allTrusted = () =>
    subjects.every(
      subject =>
        !hasHttpScripts(subject.scripts)
        || scriptsTrusted(subject.id, subject.scripts, subject.source),
    )
  const labelResults = (results: {
    assertions: import('../../../shared/httpRuntime').HttpRuntimeResult[]
    extractions: import('../../../shared/httpRuntime').HttpRuntimeResult[]
  }) => {
    if (!config)
      return results
    const requestNames = new Set(
      requestRuntime.extractions.map(rule => rule.name),
    )
    const collectionExtractions = config.runtime.extractions.filter(
      rule => !requestNames.has(rule.name),
    ).length
    results.assertions.forEach((result, index) => {
      result.source
        = index < config.runtime.assertions.length ? 'collection' : 'request'
    })
    results.extractions.forEach((result, index) => {
      result.source = index < collectionExtractions ? 'collection' : 'request'
    })
    return results
  }
  const scriptResults: HttpScriptResult[] = []
  const pendingValues = new Map<string, string | null>()
  const scriptRequest = {
    method: payload.request.method,
    url: payload.request.url,
    body: payload.request.body,
    headers: payload.request.headers,
  }
  const applyValues = (values: Record<string, string | null>) => {
    const limit = variableScopeLimit(
      new Map([
        ...Object.entries(session.variables),
        ...pendingValues,
        ...Object.entries(values),
      ]),
    )
    if (limit)
      return limit
    for (const [key, value] of Object.entries(values)) {
      pendingValues.set(key, value)
      if (value === null) {
        delete variables[key]
        delete maskedVariables[key]
      }
      else {
        variables[key] = value
        maskedVariables[key] = HTTP_SECRET_MASK
        if (value)
          secretValues.push(value)
      }
    }
  }

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

  let finalUrl = ''
  const timeoutMs = payload.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted)
    abort()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const contextTimer = setInterval(() => {
    if (!current())
      controller.abort()
  }, 100)
  const phase = async (
    name: 'preRequest' | 'postResponse',
    subject: (typeof subjects)[number],
    response: unknown = null,
  ) => {
    const code = subject.scripts?.[name]
    if (!code?.trim())
      return true
    if (!allTrusted()) {
      scriptResults.push({
        source: subject.source,
        phase: name,
        tests: [],
        error: 'untrusted',
      })
      return false
    }
    const execution = await executeScript(
      code,
      {
        request: scriptRequest,
        response,
        variables,
        environment: environment.variables,
        collectionVariables: collectionVariables(config),
      },
      controller.signal,
      (message) => {
        if (message.level === 'clear') {
          httpConsole.clear()
          return
        }
        httpConsole.append({
          kind: 'script',
          level: message.level,
          executionId,
          message: message.args
            .map(value =>
              typeof value === 'string' ? value : JSON.stringify(value),
            )
            .join(' '),
          details: { phase: name, source: subject.source, args: message.args },
        })
      },
    )
    if (execution.error) {
      httpConsole.append({
        kind: 'script',
        level: 'error',
        executionId,
        message: execution.error,
        details: { phase: name, source: subject.source },
      })
      scriptResults.push({
        source: subject.source,
        phase: name,
        tests: [],
        error: execution.error,
      })
      return false
    }
    if (applyValues(execution.output.variables)) {
      scriptResults.push({
        source: subject.source,
        phase: name,
        tests: [],
        error: 'limit',
      })
      return false
    }
    const tests = execution.output.tests.map(test => ({
      ...test,
      name: maskSecretValues(test.name, secretValues),
    }))
    scriptResults.push({ source: subject.source, phase: name, tests })
    return tests.every(test => test.ok)
  }
  let sentRequest: Parameters<typeof createHistorySnapshot>[0] | undefined
  function snapshotResult(result: HttpExecuteResult) {
    if (!sentRequest)
      return undefined
    try {
      return createHistorySnapshot(sentRequest, result, [
        ...secretValues,
        interpolated.auth.token ?? '',
        interpolated.auth.password ?? '',
        interpolated.auth.value ?? '',
      ])
    }
    catch {
      // A history failure must not change the outcome of the request.
      return undefined
    }
  }

  const startedAt = Date.now()
  const startedAtPerf = performance.now()

  try {
    if (scripted) {
      if (
        subjects.some(subject =>
          subject.scripts?.preRequest.startsWith(
            'mc.assert(false); // IMPORT_REQUIRES_ADAPTATION',
          ),
        )
      ) {
        scriptResults.push({
          phase: 'preRequest',
          tests: [],
          error: 'exception',
        })
        throw new Error('HTTP_SCRIPT_FAILED')
      }
      if (!allTrusted()) {
        scriptResults.push({
          source: subjects.find(
            subject =>
              hasHttpScripts(subject.scripts)
              && !scriptsTrusted(subject.id, subject.scripts, subject.source),
          )?.source,
          phase: runtime.scripts?.preRequest.trim()
            ? 'preRequest'
            : 'postResponse',
          tests: [],
          error: 'untrusted',
        })
        throw new Error('HTTP_SCRIPT_FAILED')
      }
      for (const subject of subjects) {
        if (!(await phase('preRequest', subject)))
          throw new Error('HTTP_SCRIPT_FAILED')
      }
      if (!allTrusted()) {
        scriptResults.push({
          phase: 'preRequest',
          tests: [],
          error: 'untrusted',
        })
        throw new Error('HTTP_SCRIPT_FAILED')
      }
      const next = interpolateRequest(payload.request, variables)
      if (
        new URL(buildUrl(next.url, next.query)).origin
          !== new URL(buildUrl(interpolated.url, interpolated.query)).origin
      ) {
        scriptResults.push({
          phase: 'preRequest',
          tests: [],
          error: 'destination',
        })
        throw new Error('HTTP_SCRIPT_FAILED')
      }
      interpolated = next
    }
    if (controller.signal.aborted)
      throw new DOMException('', 'AbortError')
    if (interpolated.bodyType === 'graphql') {
      if (interpolated.method !== 'POST')
        throw new Error('GRAPHQL_METHOD')
      interpolated.body = buildGraphqlBody(interpolated.body, variables)
    }
    const headersWithAuth = applyAuth(interpolated.auth, interpolated.headers)
    const headersObj = toHeadersObject(headersWithAuth)
    if (
      interpolated.bodyType === 'graphql'
      && !Object.keys(headersObj).some(key => key.toLowerCase() === 'accept')
    ) {
      headersObj.Accept
        = 'application/graphql-response+json, application/json;q=0.9'
    }
    const built = buildBody(
      interpolated.bodyType,
      interpolated.body,
      interpolated.formData,
    )
    if (built.body instanceof FormData) {
      // Encode once: the logged bytes and the sent multipart boundary must match.
      const encoded = new Response(built.body)
      built.body = Buffer.from(await encoded.arrayBuffer())
      built.contentType = encoded.headers.get('content-type') ?? undefined
    }
    const hasContentType = Object.keys(headersObj).some(
      k => k.toLowerCase() === 'content-type',
    )
    if (!hasContentType && built.contentType)
      headersObj['Content-Type'] = built.contentType
    finalUrl = buildUrl(interpolated.url, interpolated.query)
    sentRequest = {
      method: interpolated.method,
      url: finalUrl,
      headers: Object.entries(headersObj).map(([key, value]) => ({
        key,
        value,
      })),
      body:
        typeof built.body === 'string'
          ? built.body
          : interpolated.bodyType === 'multipart'
            ? JSON.stringify(
                interpolated.formData.map(field => ({
                  ...field,
                  value:
                    field.type === 'file' ? basename(field.value) : field.value,
                })),
              )
            : '',
    }
    const cookieJar = getHttpCookieJar()
    const response = await withHttpCookies(
      cookieJar.enabled(payload.requestId) ? cookieJar : undefined,
      () =>
        captureHttpNetwork(
          { executionId, ids: networkIds, body: sentRequest?.body ?? '' },
          () =>
            undiciRequest(finalUrl, {
              method: interpolated.method,
              headers: headersObj,
              body: built.body as Dispatcher.DispatchOptions['body'],
              signal: controller.signal,
              maxRedirections:
                scripted || interpolated.bodyType === 'graphql' ? 0 : 5,
              dispatcher: payload.skipCertificateVerification
                ? insecureCertificateDispatcher
                : certificateDispatcher,
            }),
        ),
    )

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
      ...(interpolated.bodyType === 'graphql'
        ? { graphql: graphqlResponseState(text, truncated) }
        : {}),
      status: response.statusCode,
      statusText: '',
      headers: headerEntries,
      body: text,
      bodyKind,
      durationMs,
      sizeBytes,
      truncated,
    }

    finishHttpNetwork(
      networkIds.at(-1),
      {
        bodyKind,
        sizeBytes,
        responseTruncated: truncated,
      },
      durationMs,
    )

    if (!current())
      return { ...result, body: '', headers: [], discarded: true }
    const evaluated = evaluateHttpRuntime(
      runtime,
      result,
      new Map([...Object.entries(session.variables), ...pendingValues]),
    )
    result.runtimeResults = labelResults(evaluated.results)
    if (evaluated.limit) {
      result.scriptResults = scripted ? scriptResults : undefined
      result.sessionNames = session.names
    }
    else if (scripted) {
      applyValues(Object.fromEntries(evaluated.values))
      const scriptResponse = {
        status: result.status,
        headers: result.headers,
        body: result.body,
        bodyKind: result.bodyKind,
        truncated: result.truncated,
        durationMs: result.durationMs,
      }
      let completed = true
      const postSubjects
        = config?.postResponseOrder === 'parent-first'
          ? subjects
          : [...subjects].reverse()
      for (const subject of postSubjects) {
        const success = await phase('postResponse', subject, scriptResponse)
        completed = success && completed
      }
      result.scriptResults = scriptResults
      if (!current()) {
        return {
          ...result,
          body: '',
          headers: [],
          scriptResults: [],
          discarded: true,
        }
      }
      if (!allTrusted()) {
        scriptResults.push({
          phase: 'postResponse',
          tests: [],
          error: 'untrusted',
        })
      }
      if (
        completed
        && !controller.signal.aborted
        && !scriptResults.some(phase => phase.error)
      ) {
        result.sessionNames = commitValues(pendingValues)
      }
    }
    else {
      result.sessionNames = commitValues(evaluated.values)
    }

    {
      const snapshot = snapshotResult(result)
      appendHistory(
        payload,
        snapshot?.request.url ?? buildHistoryUrl(),
        interpolated.method,
        response.statusCode,
        durationMs,
        sizeBytes,
        startedAt,
        undefined,
        snapshot,
      )
    }

    return result
  }
  catch (error) {
    const durationMs = Math.round(performance.now() - startedAtPerf)
    const message = formatHttpRequestError(error)
    const isAbort = error instanceof Error && error.name === 'AbortError'
    if (!networkIds.length) {
      httpConsole.append({
        kind: 'network',
        level: 'error',
        executionId,
        message: `${interpolated.method} ${finalUrl || interpolated.url}`,
        durationMs,
        details: { error: message },
      })
    }
    else {
      finishHttpNetwork(networkIds.at(-1), { error: message }, durationMs)
    }

    if (!current()) {
      return {
        status: null,
        statusText: '',
        headers: [],
        body: '',
        bodyKind: 'text',
        durationMs,
        sizeBytes: 0,
        truncated: false,
        discarded: true,
      }
    }

    const historyUrl = buildHistoryUrl()
    // История уходит в синхронизируемый vault. Ошибки renderer тоже не
    // должны раскрывать значения session или keychain через диагностику.
    // Сообщение undici может содержать собранный URL целиком, а также голое
    // значение секрета (например `getaddrinfo ENOTFOUND <секретный-хост>`).
    const historyError = maskSecretValues(
      finalUrl ? message.split(finalUrl).join(historyUrl) : message,
      secretValues,
    )

    const result: HttpExecuteResult = {
      status: null,
      statusText: '',
      headers: [],
      body: '',
      bodyKind: 'text',
      durationMs,
      sizeBytes: 0,
      truncated: false,
      error: isAbort
        ? `Timeout after ${timeoutMs}ms`
        : message === 'HTTP_SCRIPT_FAILED'
          || message === 'HTTP_BODY_FILE_UNAVAILABLE'
          ? message
          : secretValues.length
            ? HTTP_SECRET_MASK
            : message,
    }
    if (scripted) {
      result.scriptResults = scriptResults
      result.runtimeResults = { assertions: [], extractions: [] }
    }
    else {
      const evaluated = evaluateHttpRuntime(runtime, result)
      result.runtimeResults = labelResults(evaluated.results)
      result.sessionNames = commitValues(evaluated.values)
    }
    const snapshot = snapshotResult(result)
    appendHistory(
      payload,
      snapshot?.request.url ?? historyUrl,
      interpolated.method,
      null,
      durationMs,
      0,
      startedAt,
      snapshot?.response.error ?? historyError,
      snapshot,
    )
    return result
  }
  finally {
    clearTimeout(timer)
    clearInterval(contextTimer)
    signal?.removeEventListener('abort', abort)
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
  snapshot?: HttpHistorySnapshot,
): void {
  try {
    const storage = useHttpStorage()
    storage.history.appendEntry({
      requestId: payload.requestId,
      snapshot,
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
