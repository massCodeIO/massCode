import type { WebContents } from 'electron'
import type {
  AiHttpActionApplyResult,
  AiHttpActionView,
  AiHttpAuxAction,
  AiHttpCoreAction,
  AiHttpDraft,
} from '../../shared/aiHttpActions'
import type { HttpExecutePayload } from '../types/http'
import type { HttpAuxSnapshot } from './httpAuxActions'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { redactAiHttp } from '../../shared/aiHttp'
import {
  aiHttpActionSchema,
  aiHttpModelActionSchema,
  aiHttpRequestSchema,
  isHttpAuxAction,
} from '../../shared/aiHttpActions'
import { readGraphqlDraft } from '../../shared/httpGraphql'
import {
  getPersistedUrl,
  normalizeHttpDraftPatch,
} from '../../shared/httpUrlQuery'
import { executeOwnedHttpRequest } from '../http/runtime/ownedExecution'
import { readHttpSession } from '../http/runtime/session'
import { useHttpStorage } from '../storage'
import { store } from '../store'
import {
  applyHttpAux,
  boundedHttpData,
  controlHttpAux,
  disposeHttpAux,
  httpAuxBaseline,
  httpAuxPreviewDetails,
  prepareHttpAux,
  waitForHttpAuxControl,
} from './httpAuxActions'
import { httpRequestPreview, httpScriptPreview } from './httpPreview'
import { vaultIdentity } from './vault'
import { validateFileReferences } from './workspaceStorage'

export const httpActionTools = [
  {
    type: 'function',
    function: {
      name: 'propose_http_action',
      description:
        'Prepare ONE user-requested HTTP action for review; never executes it. Send uses the exact saved definition or captured current draft. patchDraft changes only the unsaved draft; saveDraft saves request and runtime; discardDraft drops unsaved changes. Ordinary draft changes, Save and Discard apply automatically unless preview was requested; Send always requires confirmation. Do not claim sent/saved until actual result. Assessment is not permission. runCollection requestIds specifies the full collection request set exactly once in execution order, never a subset. For individually requested saved requests use send with source saved; never broaden scope to the whole collection. It applies existing runner options and reports real results. WebSocket connect/send require review. To disconnect an approved WebSocket, call control_http_activity with {id: connectionId, action: "disconnect"}; disconnectWebSocket is not a proposal action. Cookies, clearing history/console/session and scriptTrust are reviewed actions; cookie values are never returned. Script trust is never implied by sending. For a requested change-and-send sequence call patchDraft first, then saveDraft only if saving was explicitly requested, then send with source draft. Wait for each actual successful receipt before proposing the next step. A failed or cancelled step blocks dependent actions. Cancelling Send preserves the applied draft and task Undo; never save implicitly.',
      parameters: z.toJSONSchema(aiHttpModelActionSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: 'control_http_activity',
      description:
        'Read status, cancel an HTTP action, or disconnect an approved WebSocket owned by this conversation. For a requested WebSocket disconnect call this tool with {id: connectionId, action: "disconnect"}, using the actual connectionId from the approved Connect result or read_http_state. The id also accepts the original action ID. Disconnect needs no additional Apply. Never propose disconnectWebSocket or print tool arguments instead of calling this tool. Report completion only from its actual result. Cannot start or approve actions.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          action: { enum: ['status', 'cancel', 'disconnect'] },
        },
        required: ['id', 'action'],
        additionalProperties: false,
      },
    },
  },
] as const

export function createHttpActionManager(
  owner: WebContents,
  onRun?: (actionId: string, runId: string) => void,
) {
  interface BasePlan {
    view: AiHttpActionView
    vault: string
    controller: AbortController
  }
  type CorePlan = BasePlan & {
    mode: 'core'
    action: AiHttpCoreAction
    draft?: AiHttpDraft
    baseline: string
    requestId: number
    requestCreatedAt: number
    payload: HttpExecutePayload
    networkStarted?: boolean
  }
  type AuxPlan = BasePlan & {
    mode: 'aux'
    action: AiHttpAuxAction
    snapshot: HttpAuxSnapshot
    approved?: boolean
    awaitingWebSocketAdoption?: boolean
  }
  const plans = new Map<string, CorePlan | AuxPlan>()
  const applying = new Map<string, Promise<AiHttpActionApplyResult>>()
  const completing = new Map<string, Promise<AiHttpActionApplyResult>>()
  function baseline(id: number, runtime?: HttpExecutePayload['runtime']) {
    const db = useHttpStorage()
    return JSON.stringify({
      vault: vaultIdentity(),
      request: db.requests.getRequestById(id),
      folders: db.folders.getFolders(),
      environments: db.environments.getEnvironments(),
      activeEnvironment: db.environments.getActiveEnvironmentId(),
      settings: store.preferences.get('http'),
      scripts: httpScriptPreview(
        id,
        runtime ?? db.requests.getRequestById(id)?.runtime ?? undefined,
      ),
      session: readHttpSession(
        String(vaultIdentity()),
        db.environments.getActiveEnvironmentId(),
      ),
    })
  }
  function get(id: string) {
    const plan = plans.get(id)
    if (plan && plan.vault !== String(vaultIdentity())) {
      plan.controller.abort()
      throw new Error('ACTION_STALE')
    }
    if (!plan)
      throw new Error('ACTION_UNAVAILABLE')
    return plan
  }
  const view = (id: string) => structuredClone(get(id).view)
  async function executeCore(
    id: string,
    plan: CorePlan,
  ): Promise<AiHttpActionApplyResult> {
    plan.networkStarted = true
    try {
      let responseContext: unknown
      const response = await executeOwnedHttpRequest(
        owner,
        plan.payload,
        plan.controller.signal,
        (snapshot) => {
          const headers = JSON.stringify(snapshot.response.headers)
          responseContext = {
            requestId: plan.requestId,
            source: plan.view.source,
            request: {
              method: snapshot.request.method,
              url: snapshot.request.url,
            },
            response: {
              ...snapshot.response,
              headers: headers.slice(0, 8192),
              headersTruncated: headers.length > 8192,
              body: snapshot.response.body.slice(0, 16000),
              truncated:
                snapshot.response.truncated
                || snapshot.response.body.length > 16000,
            },
          }
        },
      )
      plan.view.state = plan.controller.signal.aborted
        ? 'cancelled'
        : response.error || response.discarded
          ? 'failed'
          : 'done'
      plan.view.result = {
        ...(plan.view.result as Record<string, unknown> | undefined),
        sendAttempted: true,
        sent: response.status === null ? 'unknown' : true,
        responseContext: responseContext ?? {
          requestId: plan.requestId,
          source: plan.view.source,
          available: false,
        },
        status: response.status,
        durationMs: response.durationMs,
        sizeBytes: response.sizeBytes,
        truncated: response.truncated,
        discarded: response.discarded,
        ...(response.error ? { error: 'REQUEST_FAILED' } : {}),
      }
      return {
        view: view(id),
        response,
        execution: {
          payload: structuredClone(plan.payload),
          requestCreatedAt: plan.requestCreatedAt,
          vault: plan.vault,
        },
      }
    }
    catch {
      plan.view.state = plan.controller.signal.aborted ? 'cancelled' : 'failed'
      plan.view.result = {
        ...(plan.view.result as Record<string, unknown> | undefined),
        sendAttempted: true,
        sent: 'unknown',
        error:
          plan.view.state === 'cancelled' ? 'CANCELLED' : 'EXECUTION_FAILED',
      }
      return { view: view(id) }
    }
  }
  const manager = {
    propose(input: unknown, draft?: AiHttpDraft, userMessages: string[] = []) {
      const action = aiHttpActionSchema.parse(input)
      if (plans.size >= 30)
        throw new Error('ACTION_LIMIT')
      if (isHttpAuxAction(action)) {
        const snapshot = prepareHttpAux(owner.id, action, draft)
        const id = randomUUID()
        const publicView: AiHttpActionView = {
          id,
          action: action.action,
          summary: action.summary,
          source:
            action.action === 'connectWebSocket' ? action.source : 'workspace',
          state: 'pending',
          preview: boundedHttpData(snapshot.preview),
          ...httpAuxPreviewDetails(action, snapshot),
          request: snapshot.requestPreview,
          ...(action.action === 'sendWebSocket'
            ? {
                message: {
                  connectionId: action.connectionId,
                  text: String(redactAiHttp(action.text)).slice(0, 2000),
                  characters: action.text.length,
                },
              }
            : {}),
          ...(action.action === 'runCollection' && snapshot.run
            ? {
                run: {
                  view: structuredClone(snapshot.run),
                  requests: snapshot.requestPreviews,
                  continueOnFailure: action.continueOnFailure,
                  skipCertificateVerification:
                    store.preferences.get('http').skipCertificateVerification,
                },
              }
            : {}),
        }
        plans.set(id, {
          mode: 'aux',
          action: structuredClone(action),
          snapshot,
          view: publicView,
          vault: String(vaultIdentity()),
          controller: new AbortController(),
        })
        return view(id)
      }
      const usesDraft = action.action !== 'send' || action.source === 'draft'
      if (
        action.action === 'send'
        && draft?.protocol === 'websocket'
        && action.source === 'draft'
      ) {
        throw new Error('INVALID_HTTP_PROTOCOL')
      }
      if (usesDraft && !draft)
        throw new Error('DRAFT_UNAVAILABLE')
      const id = action.action === 'send' ? action.requestId : draft!.requestId
      if (usesDraft && id !== draft!.requestId)
        throw new Error('DRAFT_UNAVAILABLE')
      const db = useHttpStorage()
      const record = db.requests.getRequestById(id)
      if (
        !record
        || record.isDeleted
        || record.pendingCloudDownload
        || record.protocol === 'websocket'
        || record.runtimeState !== 'ready'
      ) {
        throw new Error('TARGET_UNAVAILABLE')
      }
      const settings = store.preferences.get('http')
      const payload: HttpExecutePayload = usesDraft
        ? {
            requestId: id,
            request: structuredClone(draft!.request),
            runtime: structuredClone(draft!.runtime),
            environmentId: draft!.environmentId,
            transport: structuredClone(draft!.transport),
            skipCertificateVerification: draft!.skipCertificateVerification,
          }
        : {
            requestId: id,
            request: aiHttpRequestSchema.parse(record),
            runtime: structuredClone(record.runtime!),
            environmentId: db.environments.getActiveEnvironmentId(),
            transport: settings.transport,
            skipCertificateVerification: settings.skipCertificateVerification,
          }
      if (
        action.action === 'patchDraft'
        || action.action === 'patchAndSend'
        || action.action === 'saveAndSend'
      ) {
        const fields = action.fields ?? {}
        if (action.action !== 'saveAndSend' && !Object.keys(fields).length)
          throw new Error('EMPTY_PATCH')
        const next = { ...draft!.request, ...fields }
        if (next.bodyType === 'graphql')
          readGraphqlDraft(next.body)
        if (
          next.bodyType === 'form-urlencoded'
          && fields.formData
          && next.body !== null
        ) {
          throw new Error('STRUCTURED_FORM_REQUIRES_NULL_BODY')
        }
        if (JSON.stringify(fields).includes('[REDACTED]'))
          throw new Error('REDACTED_VALUE')
        // Existing draft paths are explicitly selected by the user; new paths still require user text.
        const existing = [
          draft!.request.bodyType === 'binary'
            ? (draft!.request.body ?? '')
            : '',
          ...draft!.request.formData.filter(entry => entry.type === 'file').map(entry => entry.value),
        ]
        validateFileReferences(
          {
            space: 'http',
            kind: 'item',
            action: 'update',
            id,
            fields: {
              ...fields,
              bodyType: next.bodyType,
              body: next.body,
              formData: next.formData,
            },
          },
          userMessages,
          new Set(existing.filter(Boolean)),
        )
        {
          const { runtime, ...request } = fields
          payload.request = aiHttpRequestSchema.parse(
            normalizeHttpDraftPatch(
              payload.request,
              request,
              (runtime ?? payload.runtime)?.transport?.encodeUrl
              ?? payload.transport?.encodeUrl
              ?? true,
              payload.runtime?.transport?.encodeUrl
              ?? payload.transport?.encodeUrl
              ?? true,
            ),
          )
          if (runtime)
            payload.runtime = structuredClone(runtime)
        }
      }
      const actionId = randomUUID()
      const definition = JSON.stringify(
        redactAiHttp({
          ...payload,
          ...('fields' in action ? { changes: action.fields } : {}),
          sequence:
            action.action === 'saveAndSend'
              ? ['patchDraft', 'saveDraft', 'send']
              : action.action === 'patchAndSend'
                ? ['patchDraft', 'send']
                : [action.action],
        }),
      )
      const publicView: AiHttpActionView = {
        id: actionId,
        action: action.action,
        summary: action.summary,
        source: usesDraft ? 'draft' : 'saved',
        state: 'pending',
        request: httpRequestPreview(payload),
        changedFields:
          'fields' in action ? Object.keys(action.fields ?? {}) : [],
        preview: {
          name: record.name,
          method: payload.request.method,
          url: redactAiHttp(payload.request.url),
          environmentId: payload.environmentId,
          skipCertificateVerification: payload.skipCertificateVerification,
          transport: payload.transport,
          definition: definition.slice(0, 24000),
          definitionTruncated: definition.length > 24000,
        },
      }
      plans.set(actionId, {
        mode: 'core',
        view: publicView,
        action: structuredClone(action),
        draft: usesDraft ? structuredClone(draft) : undefined,
        vault: String(vaultIdentity()),
        baseline: baseline(id, payload.runtime),
        requestId: id,
        requestCreatedAt: record.createdAt,
        payload,
        controller: new AbortController(),
      })
      return view(actionId)
    },
    async apply(
      id: string,
      fresh?: AiHttpDraft,
    ): Promise<AiHttpActionApplyResult> {
      const plan = get(id)
      if (plan.view.state !== 'pending')
        return { view: view(id) }
      if (plan.mode === 'aux') {
        if (
          httpAuxBaseline(owner.id, plan.action, plan.snapshot)
          !== plan.snapshot.baseline
          || (plan.snapshot.draft
            && JSON.stringify(plan.snapshot.draft) !== JSON.stringify(fresh))
        ) {
          throw new Error('ACTION_STALE')
        }
        plan.approved = true
        plan.view.state = 'running'
        try {
          const result = await applyHttpAux(
            owner.id,
            plan.action,
            plan.snapshot,
            runId => onRun?.(id, runId),
          )
          plan.view.result = boundedHttpData(result)
          if (plan.action.action === 'runCollection' && plan.view.run) {
            plan.view.run.view = redactAiHttp(
              result,
            ) as typeof plan.view.run.view
          }
          const state
            = result && typeof result === 'object' && 'state' in result
              ? result.state
              : undefined
          const transportFailed
            = result
              && typeof result === 'object'
              && 'steps' in result
              && Array.isArray(result.steps)
              && result.steps.some(step => step.error)
          plan.view.state
            = plan.controller.signal.aborted || state === 'cancelled'
              ? 'cancelled'
              : state === 'error'
                || (plan.action.action === 'connectWebSocket'
                  && state !== 'open')
                || transportFailed
                || (state === 'failed' && plan.action.action !== 'runCollection')
                ? 'failed'
                : 'done'
          if (
            plan.action.action === 'connectWebSocket'
            && plan.view.state === 'done'
          ) {
            plan.awaitingWebSocketAdoption = true
            plan.view.state = 'running'
          }
        }
        catch {
          plan.view.state = plan.controller.signal.aborted
            ? 'cancelled'
            : 'failed'
          plan.view.result = { error: 'ACTION_FAILED' }
        }
        return {
          view: view(id),
          ...(plan.awaitingWebSocketAdoption
            && plan.action.action === 'connectWebSocket'
            && plan.snapshot.ws
            ? {
                webSocket: {
                  connectionId: plan.snapshot.ws.connectionId,
                  requestId: plan.snapshot.ws.requestId,
                  environmentId: plan.snapshot.ws.environmentId,
                },
              }
            : {}),
        }
      }
      if (
        plan.baseline !== baseline(plan.requestId, plan.payload.runtime)
        || (plan.draft && JSON.stringify(plan.draft) !== JSON.stringify(fresh))
      ) {
        throw new Error('ACTION_STALE')
      }
      plan.view.state = 'running'
      if (plan.action.action !== 'send')
        return { view: view(id), draftAction: structuredClone(plan.action) }
      return executeCore(id, plan)
    },
    async complete(
      id: string,
      success: boolean,
      fresh?: AiHttpDraft,
    ): Promise<AiHttpActionApplyResult> {
      const plan = get(id)
      if (['done', 'failed', 'cancelled'].includes(plan.view.state))
        return { view: view(id) }
      if (plan.mode === 'aux' && plan.awaitingWebSocketAdoption) {
        plan.awaitingWebSocketAdoption = false
        try {
          const actual = success
            ? controlHttpAux(owner.id, plan.action, plan.snapshot, 'status')
            : undefined
          if (
            success
            && actual
            && 'state' in actual
            && actual.state === 'open'
          ) {
            plan.view.state = 'done'
            plan.view.result = boundedHttpData(actual)
            return { view: view(id) }
          }
          disposeHttpAux(owner.id, plan.snapshot)
          plan.view.state = success ? 'failed' : 'cancelled'
          plan.view.result = {
            error: 'WEBSOCKET_ADOPTION_FAILED',
            connectionAdopted: false,
            cleanup: 'disposed',
          }
        }
        catch {
          let disposed = false
          try {
            disposeHttpAux(owner.id, plan.snapshot)
            disposed = true
          }
          catch {}
          plan.view.state = 'failed'
          plan.view.result = {
            error: 'WEBSOCKET_ADOPTION_FAILED',
            connectionAdopted: false,
            cleanup: disposed ? 'disposed' : 'failed',
          }
        }
        return { view: view(id) }
      }
      if (
        plan.mode === 'aux'
        || plan.action.action === 'send'
        || plan.view.state !== 'running'
        || plan.networkStarted
      ) {
        throw new Error('ACTION_UNAVAILABLE')
      }
      const compound
        = plan.action.action === 'patchAndSend'
          || plan.action.action === 'saveAndSend'
      if (!compound) {
        plan.view.state = success ? 'done' : 'failed'
        plan.view.result = {
          action: plan.action.action,
          success,
          saved: success ? plan.action.action === 'saveDraft' : 'unknown',
          sent: false,
        }
        return { view: view(id) }
      }
      const expected = {
        ...plan.draft!,
        request: plan.payload.request,
        runtime: plan.payload.runtime,
      }
      const sameDraft
        = fresh
          && isDeepStrictEqual(
            { ...fresh, contextId: '' },
            { ...expected, contextId: '' },
          )
      plan.view.result = {
        draftApplied: Boolean(sameDraft),
        saved:
          plan.action.action === 'saveAndSend'
            ? success
              ? true
              : 'unknown'
            : false,
        sent: false,
      }
      if (!success || !sameDraft) {
        plan.view.state = 'failed'
        return { view: view(id) }
      }
      const stale = () => {
        plan.view.state = 'failed'
        plan.view.result = {
          ...(plan.view.result as object),
          error: 'ACTION_STALE',
        }
        return { view: view(id) }
      }
      const before = JSON.parse(plan.baseline)
      const after = JSON.parse(baseline(plan.requestId, plan.payload.runtime))
      if (plan.action.action === 'saveAndSend') {
        const expectedRequest = {
          ...plan.payload.request,
          url: getPersistedUrl(
            plan.payload.request.url,
            plan.payload.request.query,
          ),
        }
        if (
          JSON.stringify(aiHttpRequestSchema.parse(after.request))
          !== JSON.stringify(aiHttpRequestSchema.parse(expectedRequest))
          || !isDeepStrictEqual(after.request.runtime, plan.payload.runtime)
        ) {
          return stale()
        }
        const permitted = new Set([
          ...Object.keys(expectedRequest),
          'runtime',
          'runtimeRevision',
          'updatedAt',
          ...Object.keys(plan.draft!.savedFields ?? {}),
        ])
        const metadata = (record: Record<string, unknown>) => ({
          ...Object.fromEntries(
            Object.entries(record).filter(([key]) => !permitted.has(key)),
          ),
          // Saved HTTP records may omit the protocol; the editor writes its default.
          protocol: record.protocol ?? 'http',
        })
        if (
          !isDeepStrictEqual(metadata(before.request), metadata(after.request))
        ) {
          return stale()
        }
        for (const [key, value] of Object.entries(
          plan.draft!.savedFields ?? {},
        )) {
          if (after.request[key] !== value)
            return stale()
        }
        before.request = null
        after.request = null
      }
      if (JSON.stringify(before) !== JSON.stringify(after))
        return stale()
      return executeCore(id, plan)
    },
    control(id: string, action: 'status' | 'cancel' | 'disconnect') {
      const resolved
        = plans.get(id)
          ?? [...plans.values()].find(
            plan =>
              plan.mode === 'aux'
              && plan.approved
              && plan.action.action === 'connectWebSocket'
              && plan.snapshot.ws?.connectionId === id,
          )
      const plan = get(resolved?.view.id ?? id)
      id = plan.view.id
      if (plan.mode === 'aux' && plan.approved) {
        const result = controlHttpAux(
          owner.id,
          plan.action,
          plan.snapshot,
          action,
        )
        if (result)
          plan.view.result = boundedHttpData(result)
        if (action !== 'status') {
          plan.controller.abort()
          plan.view.state = 'cancelled'
        }
        return view(id)
      }
      if (
        action === 'cancel'
        && (plan.view.state === 'pending' || plan.view.state === 'running')
      ) {
        plan.controller.abort()
        plan.view.state = 'cancelled'
      }
      return view(id)
    },
    clear() {
      for (const plan of plans.values()) {
        plan.controller.abort()
        if (plan.mode === 'aux')
          disposeHttpAux(owner.id, plan.snapshot)
      }
      plans.clear()
      applying.clear()
      completing.clear()
    },
  }
  return {
    ...manager,
    async controlAndWait(
      id: string,
      action: 'status' | 'cancel' | 'disconnect',
    ) {
      const initial = manager.control(id, action)
      const plan = get(initial.id)
      if (action !== 'status' && plan.mode === 'aux' && plan.approved) {
        const completed = await waitForHttpAuxControl(
          owner.id,
          plan.action,
          plan.snapshot,
        )
        if (completed)
          plan.view.result = boundedHttpData(completed)
      }
      return view(initial.id)
    },
    async cancel(id: string) {
      get(id)
      const executing = completing.get(id) ?? applying.get(id)
      const cancelled = manager.control(id, 'cancel')
      if (!executing) {
        const plan = get(id)
        if (plan.mode === 'aux' && plan.approved) {
          const completed = await waitForHttpAuxControl(
            owner.id,
            plan.action,
            plan.snapshot,
          )
          if (completed)
            plan.view.result = boundedHttpData(completed)
        }
        return view(cancelled.id)
      }
      const result = await executing
      return result.view.state === 'running' ? view(id) : result.view
    },
    async apply(id: string, fresh?: AiHttpDraft) {
      get(id)
      if (completing.has(id))
        return completing.get(id)!
      if (!applying.has(id)) {
        applying.set(
          id,
          manager.apply(id, fresh).catch((error) => {
            applying.delete(id)
            throw error
          }),
        )
      }
      return applying.get(id)!
    },
    async complete(id: string, success: boolean, fresh?: AiHttpDraft) {
      get(id)
      if (!completing.has(id)) {
        completing.set(
          id,
          manager.complete(id, success, fresh).catch((error) => {
            completing.delete(id)
            throw error
          }),
        )
      }
      return completing.get(id)!
    },
  }
}
