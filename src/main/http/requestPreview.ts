import type { AiHttpRequestPreview } from '../../shared/aiHttpActions'
import type { HttpExecutePayload } from '../types/http'
import { redactAiHttp } from '../../shared/aiHttp'
import { applyHttpApiKey } from '../../shared/httpAuth'
import {
  applyHttpCollection,
  collectionVariables,
  mergeHttpCollectionRuntime,
} from '../../shared/httpCollection'
import { emptyHttpRuntime } from '../../shared/httpRuntime'
import { hasHttpScripts } from '../../shared/httpScripts'
import { resolveHttpTransport } from '../../shared/httpTransport'
import { applyQueryToUrl } from '../../shared/httpUrlQuery'
import {
  interpolateHttpVariables,
  maskHttpSecretVariables,
} from '../../shared/httpVariables'
import { useHttpStorage } from '../storage'
import { store } from '../store'
import { resolveHttpCollection } from './collection'
import { readHttpSession } from './runtime/session'
import { scriptsTrusted } from './scripts/trust'

export function httpScriptPreview(id: number, runtime = emptyHttpRuntime()) {
  const record = useHttpStorage().requests.getRequestById(id)
  const collection = resolveHttpCollection(record?.folderId)
  return [
    ...(collection?.scopes ?? []).map(scope => ({
      source: 'collection' as const,
      id: scope.id,
      scripts: scope.config?.runtime.scripts,
    })),
    { source: 'request' as const, id, scripts: runtime.scripts },
  ]
    .filter(subject => hasHttpScripts(subject.scripts))
    .map(subject => ({
      source: subject.source,
      id: subject.id,
      preRequest: Boolean(subject.scripts?.preRequest.trim()),
      postResponse: Boolean(subject.scripts?.postResponse.trim()),
      trusted: scriptsTrusted(
        subject.id,
        subject.scripts,
        subject.source,
        true,
      ),
    }))
}
export function httpRequestPreview(
  payload: HttpExecutePayload,
  options: { includeSession?: boolean, protocol?: 'http' | 'websocket' } = {},
): AiHttpRequestPreview {
  const db = useHttpStorage()
  const record
    = payload.requestId === null
      ? undefined
      : db.requests.getRequestById(payload.requestId)
  const collection = resolveHttpCollection(record?.folderId)
  const request = applyHttpCollection(payload.request, collection?.config)
  const webSocket = options.protocol === 'websocket'
  const runtime = mergeHttpCollectionRuntime(
    payload.runtime ?? emptyHttpRuntime(),
    collection?.config?.runtime,
  )
  const scripts
    = webSocket || payload.requestId === null
      ? []
      : httpScriptPreview(payload.requestId, payload.runtime)
  const transport = webSocket
    ? {
        skipCertificateVerification:
          payload.skipCertificateVerification ?? false,
        timeoutMs: 15000,
        followRedirects: false,
        maxRedirects: 0,
        protocolVersion: 'http1' as const,
        encodeUrl: true,
      }
    : resolveHttpTransport(
        {
          skipCertificateVerification: payload.skipCertificateVerification,
          ...payload.transport,
        },
        runtime.transport,
        scripts.length > 0 || request.bodyType === 'graphql',
      )
  const environment = db.environments
    .getEnvironments()
    .find(item => item.id === payload.environmentId)
  const session
    = options.includeSession !== false
      ? readHttpSession(
          String(store.preferences.get('storage.vaultPath') ?? ''),
          payload.environmentId,
        )
      : { variables: {}, names: [] }
  const variables = redactAiHttp({
    ...collectionVariables(collection?.config),
    ...maskHttpSecretVariables(
      environment?.variables ?? {},
      environment?.secretKeys ?? [],
    ),
    ...maskHttpSecretVariables(session.variables, session.names),
  }) as Record<string, string>
  const masked = applyHttpApiKey(
    {
      ...request,
      auth:
        request.auth.type === 'apikey'
          ? { ...request.auth, value: '[REDACTED]' }
          : request.auth,
    },
    variables,
  )
  const resolved = {
    url: interpolateHttpVariables(masked.url, variables),
    query: masked.query.map(entry => ({
      ...entry,
      key: interpolateHttpVariables(entry.key, variables),
      value: interpolateHttpVariables(entry.value, variables),
    })),
  }
  const url = resolved.query.length
    ? applyQueryToUrl(resolved.url, resolved.query, transport.encodeUrl)
    : resolved.url
  return {
    requestId: payload.requestId,
    name: record?.name ?? '',
    method: webSocket ? 'GET' : request.method,
    url: String(redactAiHttp(url)).slice(0, 8192),
    environmentName: environment?.name ?? null,
    bodyType: webSocket ? 'none' : request.bodyType,
    bodyCharacters: request.body?.length ?? 0,
    formEntries: request.formData.filter(item => item.enabled !== false)
      .length,
    headers: request.headers.filter(item => item.enabled !== false).length,
    authType: request.auth.type,
    scripts,
    transport,
  }
}
