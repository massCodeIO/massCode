import type {
  AiHttpActionView,
  AiHttpAuxAction,
  AiHttpDraft,
  AiHttpRequestPreview,
} from '../../shared/aiHttpActions'
import type { HttpCookieSnapshot } from '../../shared/httpCookies'
import type { HttpRunView } from '../../shared/httpRunner'
import type { HttpScripts } from '../../shared/httpScripts'
import type { WsConnect } from '../../shared/httpWebSocket'
import { createHash, randomUUID } from 'node:crypto'
import { Cookie } from 'tough-cookie'
import { redactAiHttp } from '../../shared/aiHttp'
import { readHttpCollection } from '../../shared/httpCollection'
import { emptyHttpRuntime } from '../../shared/httpRuntime'
import { emptyHttpScripts } from '../../shared/httpScripts'
import { wsConnectSchema } from '../../shared/httpWebSocket'
import { getHttpCookieJar } from '../http/cookies/store'
import { httpConsole } from '../http/devtools/console'
import {
  setEnvironmentSecretHandler,
  unprotectEnvironmentSecretHandler,
} from '../http/environmentSecrets'
import {
  cancelHttpRun,
  disposeHttpRun,
  getHttpRun,
  prepareHttpRunSnapshot,
  registerHttpRun,
  startHttpRun,
} from '../http/runtime/runner'
import {
  getHttpSession,
  readHttpSession,
  resetHttpSession,
} from '../http/runtime/session'
import { scriptsTrusted, setScriptTrust } from '../http/scripts/trust'
import { revealEnvironmentSecret } from '../http/secrets'
import {
  clearWebSocket,
  connectWebSocket,
  disconnectWebSocket,
  disposeWebSocket,
  readWebSocket,
  readWebSocketForAi,
  sendWebSocket,
  waitForWebSocket,
} from '../http/websocket/session'
import { useHttpStorage } from '../storage'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { store } from '../store'
import { httpRequestPreview, httpScriptPreview } from './httpPreview'
import { vaultIdentity } from './vault'

export interface HttpAuxSnapshot {
  baseline: string
  preparedRun?: ReturnType<typeof prepareHttpRunSnapshot>
  run?: HttpRunView
  ws?: WsConnect
  draft?: AiHttpDraft
  cookies?: HttpCookieSnapshot
  scripts?: HttpScripts
  preview: unknown
  requestPreview?: AiHttpRequestPreview
  requestPreviews?: AiHttpRequestPreview[]
}
export function publicCookies(snapshot: HttpCookieSnapshot) {
  return {
    ...snapshot,
    cookies: snapshot.cookies.map(
      ({ value: _value, raw: _raw, ...cookie }) => ({
        ...cookie,
        value: '[REDACTED]',
      }),
    ),
  }
}
export function boundedHttpData(value: unknown, offset = 0, limit = 16000) {
  const content = JSON.stringify(redactAiHttp(value))
  return {
    content: content.slice(offset, offset + limit),
    totalLength: content.length,
    nextOffset: offset + limit < content.length ? offset + limit : null,
  }
}
function scriptData(action: { id: number, subject: 'request' | 'collection' }) {
  const db = useHttpStorage()
  const target
    = action.subject === 'request'
      ? db.requests.getRequestById(action.id)
      : db.folders.getFolders().find(folder => folder.id === action.id)
  if (
    !target
    || ('isDeleted' in target && target.isDeleted)
    || ('pendingCloudDownload' in target && target.pendingCloudDownload)
  ) {
    throw new Error('TARGET_UNAVAILABLE')
  }
  const scripts
    = 'runtime' in target
      ? target.runtime?.scripts
      : action.subject === 'collection'
        ? readHttpCollection(
          db.folders.getFolders().find(folder => folder.id === action.id),
        )?.runtime.scripts
        : undefined
  return { target, scripts: scripts ?? emptyHttpScripts() }
}
export function httpAuxBaseline(
  owner: number,
  action: AiHttpAuxAction,
  snapshot: HttpAuxSnapshot,
) {
  const db = useHttpStorage()
  let data: unknown
  switch (action.action) {
    case 'runCollection':
      data = {
        records: snapshot.run!.steps.map(step =>
          db.requests.getRequestById(step.requestId),
        ),
        folders: db.folders.getFolders(),
        environments: db.environments.getEnvironments(),
        active: db.environments.getActiveEnvironmentId(),
        settings: store.preferences.get('http'),
        scripts: snapshot.run!.steps.map(step =>
          httpScriptPreview(
            step.requestId,
            db.requests.getRequestById(step.requestId)?.runtime ?? undefined,
          ),
        ),
        session: readHttpSession(
          String(vaultIdentity()),
          db.environments.getActiveEnvironmentId(),
        ),
      }
      break
    case 'connectWebSocket':
      data = {
        record: db.requests.getRequestById(action.requestId),
        session: readHttpSession(
          String(vaultIdentity()),
          db.environments.getActiveEnvironmentId(),
        ),
        folders: db.folders.getFolders(),
        environments: db.environments.getEnvironments(),
        active: db.environments.getActiveEnvironmentId(),
        settings: store.preferences.get('http'),
      }
      break
    case 'sendWebSocket':
    case 'clearWebSocket': {
      const view = readWebSocket(owner, action.connectionId, 0)
      data = {
        id: view.connectionId,
        state: view.state,
        ...(action.action === 'clearWebSocket'
          ? { lastId: view.lastId, dropped: view.dropped }
          : {}),
      }
      break
    }
    case 'clearHistory':
      data = db.history.getEntries()
      break
    case 'clearConsole':
      data = httpConsole.read().revision
      break
    case 'clearSession': {
      const session = getHttpSession(
        String(vaultIdentity()),
        db.environments.getActiveEnvironmentId(),
      )
      data = session
      break
    }
    case 'protectVariable':
    case 'unprotectVariable': {
      const environment = db.environments
        .getEnvironments()
        .find(env => env.id === action.environmentId)
      data = {
        environment,
        value:
          action.action === 'unprotectVariable' && environment
            ? revealEnvironmentSecret(
                environment.secretStorageId ?? String(environment.id),
                action.key,
              )
            : undefined,
      }
      break
    }
    case 'scriptTrust': {
      const script = scriptData(action)
      data = {
        ...script,
        trusted: scriptsTrusted(action.id, script.scripts, action.subject),
      }
      break
    }
    default:
      data = getHttpCookieJar().read(
        action.action === 'cookiesEnabled' ? action.requestId : null,
      )
  }
  return JSON.stringify({ vault: vaultIdentity(), data })
}
export function prepareHttpAux(
  owner: number,
  action: AiHttpAuxAction,
  draft?: AiHttpDraft,
): HttpAuxSnapshot {
  const snapshot: HttpAuxSnapshot = { baseline: '', preview: {} }
  const db = useHttpStorage()
  switch (action.action) {
    case 'runCollection': {
      snapshot.preparedRun = prepareHttpRunSnapshot(owner, action.folderId)
      snapshot.run = structuredClone(snapshot.preparedRun.view)
      const ids
        = action.requestIds ?? snapshot.run.steps.map(step => step.requestId)
      if (
        ids.length !== snapshot.run.steps.length
        || new Set(ids).size !== ids.length
        || ids.some(
          id => !snapshot.run!.steps.some(step => step.requestId === id),
        )
      ) {
        throw new Error('HTTP_RUN_INVALID_ORDER')
      }
      snapshot.run.steps = ids.map(
        id => snapshot.run!.steps.find(step => step.requestId === id)!,
      )
      snapshot.requestPreviews = snapshot.run.steps.map((step) => {
        const payload = snapshot.preparedRun!.requests.get(step.requestId)!
        const settings = store.preferences.get('http')
        return httpRequestPreview(
          {
            ...payload,
            transport: settings.transport,
            skipCertificateVerification: settings.skipCertificateVerification,
          },
          { includeSession: false },
        )
      })
      snapshot.preview = {
        run: snapshot.run,
        options: {
          continueOnFailure: action.continueOnFailure,
          ...store.preferences.get('http'),
        },
      }
      break
    }
    case 'connectWebSocket': {
      const record = db.requests.getRequestById(action.requestId)
      if (
        !record
        || record.isDeleted
        || record.pendingCloudDownload
        || record.protocol !== 'websocket'
      ) {
        throw new Error('TARGET_UNAVAILABLE')
      }
      if (
        action.source === 'draft'
        && (!draft
          || draft.requestId !== action.requestId
          || draft.protocol !== 'websocket')
      ) {
        throw new Error('DRAFT_UNAVAILABLE')
      }
      snapshot.draft
        = action.source === 'draft' ? structuredClone(draft) : undefined
      const request = snapshot.draft?.request ?? record
      snapshot.ws = wsConnectSchema.parse({
        ...request,
        connectionId: randomUUID(),
        requestId: action.requestId,
        environmentId:
          snapshot.draft?.environmentId
          ?? db.environments.getActiveEnvironmentId(),
        skipCertificateVerification:
          snapshot.draft?.skipCertificateVerification
          ?? store.preferences.get('http').skipCertificateVerification,
      })
      snapshot.requestPreview = httpRequestPreview(
        {
          requestId: record.id,
          request,
          environmentId: snapshot.ws.environmentId,
          runtime: emptyHttpRuntime(),
          skipCertificateVerification: snapshot.ws.skipCertificateVerification,
        },
        { protocol: 'websocket' },
      )
      snapshot.preview = redactAiHttp(snapshot.ws)
      break
    }
    case 'sendWebSocket':
    case 'clearWebSocket':
      snapshot.preview = {
        connectionId: action.connectionId,
        current: readWebSocket(owner, action.connectionId, 0).state,
        ...(action.action === 'sendWebSocket'
          ? { text: redactAiHttp(action.text) }
          : {}),
      }
      break
    case 'protectVariable':
    case 'unprotectVariable': {
      const environment = db.environments
        .getEnvironments()
        .find(env => env.id === action.environmentId)
      if (
        !environment
        || (action.action === 'protectVariable'
          ? !Object.hasOwn(environment.variables, action.key)
          || environment.secretKeys?.includes(action.key)
          : !environment.secretKeys?.includes(action.key))
      ) {
        throw new Error('TARGET_UNAVAILABLE')
      }
      snapshot.preview = {
        environmentId: environment.id,
        name: environment.name,
        key: action.key,
        action: action.action,
      }
      break
    }
    case 'scriptTrust': {
      const script = scriptData(action)
      snapshot.scripts = structuredClone(script.scripts)
      snapshot.preview = {
        subject: action.subject,
        id: action.id,
        name: script.target.name,
        allowed: action.allowed,
        scriptsHash: createHash('sha256')
          .update(JSON.stringify(script.scripts))
          .digest('hex'),
        currentTrust: scriptsTrusted(action.id, script.scripts, action.subject),
      }
      break
    }
    case 'clearHistory':
      snapshot.preview = {
        count: db.history.getEntries().length,
        irreversible: true,
      }
      break
    case 'clearConsole':
      snapshot.preview = {
        count: httpConsole.read().entries.length,
        scope: 'application HTTP console',
        irreversible: true,
      }
      break
    case 'clearSession':
      snapshot.preview = {
        names: getHttpSession(
          String(vaultIdentity()),
          db.environments.getActiveEnvironmentId(),
        ).names,
        irreversible: true,
      }
      break
    default: {
      snapshot.cookies = structuredClone(
        getHttpCookieJar().read(
          action.action === 'cookiesEnabled' ? action.requestId : null,
        ),
      )
      if (
        (action.action === 'cookieMetadata'
          || action.action === 'cookieDelete')
        && !snapshot.cookies.cookies.some(cookie => cookie.id === action.id)
      ) {
        throw new Error('TARGET_UNAVAILABLE')
      }
      snapshot.preview = {
        operation:
          action.action === 'cookieCreate'
            ? {
                ...action,
                raw: '[REDACTED]',
                name: Cookie.parse(action.raw)?.key,
              }
            : action,
        before: publicCookies(snapshot.cookies),
        irreversible: true,
      }
    }
  }
  snapshot.baseline = httpAuxBaseline(owner, action, snapshot)
  return snapshot
}
export async function applyHttpAux(
  owner: number,
  action: AiHttpAuxAction,
  snapshot: HttpAuxSnapshot,
  onRun?: (runId: string) => void,
) {
  const jar = getHttpCookieJar()
  const db = useHttpStorage()
  switch (action.action) {
    case 'runCollection': {
      registerHttpRun(owner, snapshot.preparedRun!)
      onRun?.(snapshot.run!.runId)
      const settings = store.preferences.get('http')
      return startHttpRun(owner, {
        runId: snapshot.run!.runId,
        requestIds: snapshot.run!.steps.map(step => step.requestId),
        continueOnFailure: action.continueOnFailure,
        skipCertificateVerification: settings.skipCertificateVerification,
        transport: settings.transport,
      })
    }
    case 'connectWebSocket':
      connectWebSocket(owner, snapshot.ws!)
      await waitForWebSocket(owner, snapshot.ws!.connectionId, 'connected')
      return readWebSocketForAi(owner, snapshot.ws!.connectionId, 0)
    case 'sendWebSocket':
      await sendWebSocket(owner, action.connectionId, action.text)
      return readWebSocketForAi(owner, action.connectionId, 0)
    case 'clearWebSocket':
      clearWebSocket(owner, action.connectionId)
      return readWebSocketForAi(owner, action.connectionId, 0)
    case 'clearHistory':
      db.history.clear()
      return { remaining: db.history.getEntries().length }
    case 'clearConsole':
      httpConsole.clear()
      return { remaining: httpConsole.read().entries.length }
    case 'clearSession':
      resetHttpSession()
      return {
        names: getHttpSession(
          String(vaultIdentity()),
          db.environments.getActiveEnvironmentId(),
        ).names,
      }
    case 'protectVariable':
    case 'unprotectVariable': {
      const environment = db.environments
        .getEnvironments()
        .find(env => env.id === action.environmentId)!
      const result
        = action.action === 'protectVariable'
          ? setEnvironmentSecretHandler({
              environmentId: action.environmentId,
              key: action.key,
              value: environment.variables[action.key],
            })
          : unprotectEnvironmentSecretHandler({
              environmentId: action.environmentId,
              key: action.key,
            })
      if (!result.ok)
        throw new Error('SECRET_ACTION_FAILED')
      const after = db.environments
        .getEnvironments()
        .find(env => env.id === action.environmentId)!
      return {
        environmentId: after.id,
        key: action.key,
        protected: after.secretKeys?.includes(action.key) ?? false,
      }
    }
    case 'scriptTrust':
      setScriptTrust(
        action.id,
        snapshot.scripts!,
        action.allowed,
        action.subject,
      )
      return {
        trusted: scriptsTrusted(action.id, snapshot.scripts!, action.subject),
        allowed: action.allowed,
      }
    case 'cookieCreate':
      jar.save(action.domain, action.raw)
      break
    case 'cookieMetadata': {
      const original = snapshot.cookies!.cookies.find(
        cookie => cookie.id === action.id,
      )!
      const cookie = Cookie.parse(original.raw)!
      if (action.fields.path !== undefined)
        cookie.path = action.fields.path
      if (action.fields.secure !== undefined)
        cookie.secure = action.fields.secure
      if (action.fields.httpOnly !== undefined)
        cookie.httpOnly = action.fields.httpOnly
      if (action.fields.expires !== undefined) {
        cookie.expires
          = action.fields.expires === null
            ? 'Infinity'
            : new Date(action.fields.expires)
      }
      jar.save(original.domain, cookie.toString(), original.id)
      break
    }
    case 'cookieDelete':
      jar.remove(action.id)
      break
    case 'cookieDomainAdd':
      jar.addDomain(action.domain)
      break
    case 'cookieDomainDelete':
      jar.removeDomain(action.domain)
      break
    case 'cookiesEnabled':
      jar.setEnabled(action.requestId, action.enabled)
      break
    case 'clearCookies':
      jar.clear()
      break
  }
  return publicCookies(
    jar.read(action.action === 'cookiesEnabled' ? action.requestId : null),
  )
}
export function controlHttpAux(
  owner: number,
  action: AiHttpAuxAction,
  snapshot: HttpAuxSnapshot,
  control: 'status' | 'cancel' | 'disconnect',
) {
  if (snapshot.run) {
    if (control === 'cancel')
      cancelHttpRun(owner, snapshot.run.runId)
    return getHttpRun(owner, snapshot.run.runId)
  }
  const connectionId
    = snapshot.ws?.connectionId
      ?? ('connectionId' in action ? action.connectionId : undefined)
  if (connectionId) {
    if (control !== 'status')
      disconnectWebSocket(owner, connectionId)
    return readWebSocketForAi(owner, connectionId, 0)
  }
  return undefined
}
export function disposeHttpAux(owner: number, snapshot: HttpAuxSnapshot) {
  if (snapshot.run) {
    try {
      getHttpRun(owner, snapshot.run.runId)
      disposeHttpRun(owner)
    }
    catch {}
  }
  if (snapshot.ws)
    disposeWebSocket(owner, snapshot.ws.connectionId)
}
export function readHttpAuxState(
  owner: number,
  input: {
    kind: string
    id?: number
    activityId?: string
    offset?: number
    limit?: number
    subject?: 'request' | 'collection'
  },
) {
  const db = useHttpStorage()
  const offset = input.offset ?? 0
  const limit = Math.min(input.limit ?? 16000, 16000)
  switch (input.kind) {
    case 'history': {
      const snapshot
        = input.id === undefined ? undefined : db.history.getSnapshot(input.id)
      // Existing history snapshots store pre-transport input; they have no wire capture.
      // In particular, the Cookie interceptor runs after these headers are collected.
      return boundedHttpData(
        input.id === undefined
          ? db.history.getEntries()
          : snapshot
            ? {
                executionInput: snapshot.request,
                capturedRequest: null,
                evidence:
                  'History stores request input before transport adds Cookie and other headers, not the captured outgoing request. Missing headers here do not prove they were not sent. Captured outgoing headers are unavailable in this history snapshot. If read_http_context is available for the attached request, inspect its response executionTrace and verify it matches this execution before using it as evidence. Use read_http_state with kind console for safe captured outgoing attempts when available. Match historyId when present, otherwise requestId and requestedAt from the history list plus URL, executionId and hopIndex; follow nextOffset for more entries. Legacy or cleared console entries may lack capture. If no matching complete capture exists, report outgoing headers as unknown.',
                response: snapshot.response,
              }
            : snapshot,
        offset,
        limit,
      )
    }
    case 'runner':
      return boundedHttpData(
        getHttpRun(owner, input.activityId!),
        offset,
        limit,
      )
    case 'websocket':
      return boundedHttpData(
        readWebSocketForAi(owner, input.activityId!, 0),
        offset,
        limit,
      )
    case 'session':
      return {
        names: getHttpSession(
          String(vaultIdentity()),
          db.environments.getActiveEnvironmentId(),
        ).names,
      }
    case 'console':
      return boundedHttpData(
        httpConsole.readForAi(getVaultPath()),
        offset,
        limit,
      )
    case 'cookies':
      return boundedHttpData(
        publicCookies(getHttpCookieJar().read(input.id ?? null)),
        offset,
        limit,
      )
    case 'scriptTrust': {
      const action = { id: input.id!, subject: input.subject ?? 'request' }
      const script = scriptData(action)
      return {
        ...action,
        trusted: scriptsTrusted(action.id, script.scripts, action.subject),
      }
    }
    default:
      throw new Error('UNKNOWN_HTTP_STATE')
  }
}

export function httpAuxPreviewDetails(
  action: AiHttpAuxAction,
  snapshot: HttpAuxSnapshot,
): Pick<AiHttpActionView, 'details' | 'irreversible' | 'trust' | 'cookie'> {
  const data = snapshot.preview as Record<string, unknown>
  const details: NonNullable<AiHttpActionView['details']> = []
  for (const [key, label] of [
    ['name', 'target'],
    ['key', 'variable'],
    ['count', 'count'],
    ['scope', 'scope'],
  ] as const) {
    if (typeof data[key] === 'string' || typeof data[key] === 'number') {
      details.push({
        label,
        value: String(redactAiHttp(data[key])).slice(0, 1000),
      })
    }
  }
  if ('domain' in action) {
    details.push({
      label: 'domain',
      value: String(redactAiHttp(action.domain)).slice(0, 1000),
    })
  }
  if ('id' in action && !data.name)
    details.push({ label: 'target', value: String(action.id) })
  if ('connectionId' in action)
    details.push({ label: 'target', value: action.connectionId })
  if (action.action === 'scriptTrust')
    details.push({ label: 'scope', value: action.subject })
  let cookie: AiHttpActionView['cookie']
  if (action.action === 'cookiesEnabled')
    cookie = { requestId: action.requestId, enabled: action.enabled }
  if (action.action === 'cookieCreate')
    cookie = { name: Cookie.parse(action.raw)?.key }
  if (action.action === 'cookieMetadata' || action.action === 'cookieDelete') {
    const before = snapshot.cookies?.cookies.find(
      item => item.id === action.id,
    )
    cookie = { name: before?.name }
    if (before && action.action === 'cookieMetadata') {
      cookie.changes = Object.entries(action.fields).map(([field, after]) => ({
        field: field as 'path' | 'secure' | 'httpOnly' | 'expires',
        before: before[field as keyof typeof action.fields],
        after,
      }))
    }
  }
  if (action.action === 'clearSession' && Array.isArray(data.names))
    details.push({ label: 'count', value: String(data.names.length) })
  return {
    details,
    cookie,
    irreversible:
      data.irreversible === true || action.action === 'clearWebSocket',
    ...(action.action === 'scriptTrust'
      ? { trust: { allowed: action.allowed } }
      : {}),
  }
}

export async function waitForHttpAuxControl(
  owner: number,
  action: AiHttpAuxAction,
  snapshot: HttpAuxSnapshot,
) {
  const id
    = snapshot.ws?.connectionId
      ?? ('connectionId' in action ? action.connectionId : undefined)
  if (!id)
    return undefined
  await waitForWebSocket(owner, id, 'closed')
  return readWebSocketForAi(owner, id, 0)
}
