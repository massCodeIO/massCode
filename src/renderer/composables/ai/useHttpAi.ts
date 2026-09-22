import type { HttpExecuteResult } from '~/main/types/http'
import type { AiHttpContext, AiHttpProposal } from '~/shared/aiHttp'
import type { AiHttpAction, AiHttpDraft } from '~/shared/aiHttpActions'
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpEnvironments } from '@/composables/spaces/http/useHttpEnvironments'
import { useHttpExecute } from '@/composables/spaces/http/useHttpExecute'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { useHttpSettings } from '@/composables/spaces/http/useHttpSettings'
import { useHttpWebSocket } from '@/composables/spaces/http/useHttpWebSocket'
import { store } from '@/electron'
import {
  aiHttpProposalSchema,
  httpContextText,
  redactAiHttp,
} from '~/shared/aiHttp'
import { aiHttpDraftSchema } from '~/shared/aiHttpActions'
import { httpRuntimeSchema } from '~/shared/httpRuntime'
import { normalizeHttpDraftPatch } from '~/shared/httpUrlQuery'
import { useAi } from './useAi'

export interface HttpAiSnapshot {
  context: AiHttpContext
  privateDraft?: AiHttpDraft
  baseline: string
}

export function useHttpAi() {
  const {
    currentRequest,
    currentDraft,
    isCurrentRequestLoading,
    selectedRequestIds,
  } = useHttpRequests()
  const {
    draft: runtime,
    busy,
    saveRequest,
    discardRequestChanges,
  } = useHttpRuntime()
  const {
    lastResponse,
    lastError,
    lastExecutionRequest,
    isExecuting,
    executeCurrentRequest,
    captureSavedExecutionResult,
  } = useHttpExecute()
  const { activeEnvironmentId } = useHttpEnvironments()
  const { httpState } = useHttpApp()
  const { settings } = useHttpSettings()
  function baseline() {
    return JSON.stringify({
      vault: store.preferences.get('storage.vaultPath'),
      id: currentRequest.value?.id,
      request: currentDraft.value,
      runtime: runtime.value,
      revision: currentRequest.value?.runtimeRevision,
      environment: activeEnvironmentId.value,
      settings,
      response: lastResponse.value,
      error: lastError.value,
    })
  }
  function read(): HttpAiSnapshot | undefined {
    const request = currentRequest.value
    if (
      !request
      || !currentDraft.value
      || isCurrentRequestLoading.value
      || isExecuting.value
      || busy.value
      || request.runtimeState !== 'ready'
      || request.pendingCloudDownload
      || httpState.requestId !== request.id
      || (httpState.activePanel && httpState.activePanel !== 'request')
    ) {
      return
    }
    const { truncated, ...response } = lastResponse.value ?? {}
    const availability
      = lastResponse.value?.bodyKind === 'binary'
        ? 'The response body is binary; its text is not available.'
        : truncated === true
          ? 'The captured response body is incomplete. Missing bytes cannot be retrieved by paging this snapshot.'
          : truncated === false
            ? 'The complete response body was captured.'
            : 'Response body completeness was not recorded.'
    const contextId = crypto.randomUUID()
    const privateDraft = aiHttpDraftSchema.safeParse(
      JSON.parse(
        JSON.stringify({
          contextId,
          protocol: currentDraft.value.protocol,
          ...(currentDraft.value.description !== undefined
            && currentDraft.value.folderId !== undefined
            ? {
                savedFields: {
                  description: currentDraft.value.description,
                  folderId: currentDraft.value.folderId,
                },
              }
            : {}),
          requestId: request.id,
          environmentId: activeEnvironmentId.value,
          request: {
            method: currentDraft.value.method,
            url: currentDraft.value.url,
            headers: currentDraft.value.headers,
            query: currentDraft.value.query,
            bodyType: currentDraft.value.bodyType,
            body: currentDraft.value.body,
            formData: currentDraft.value.formData,
            auth: currentDraft.value.auth,
          },
          runtime: runtime.value,
          transport: settings.transport ?? {},
          skipCertificateVerification: settings.skipCertificateVerification,
        }),
      ),
    )
    return {
      privateDraft: privateDraft.success ? privateDraft.data : undefined,
      baseline: baseline(),
      context: {
        contextId,
        requestId: request.id,
        name: request.name,
        request: httpContextText({
          ...currentDraft.value,
          auth: { type: currentDraft.value.auth.type },
          environmentId: activeEnvironmentId.value,
          environmentValues:
            'Not resolved. Secret variables are never read for AI.',
        }),
        response:
          lastResponse.value || lastError.value
            ? httpContextText({
                ...response,
                ...(lastError.value ? { error: lastError.value } : {}),
                executionInput: lastExecutionRequest.value,
                note: `${availability} Outgoing body bytes are not captured: neither Content-Type nor the configured body proves what body was transmitted. Captured outgoing attempts contain request headers and URLs for each hop, with secrets removed. The first entry is the initial attempt; subsequent entries are followed redirects. The last entry is the last attempted URL (the final response URL only on success). Missing request headers means outgoing header capture is unavailable. An empty list of attempts means capture is unavailable, not that no headers were sent. The request definition used for this execution is captured before variable interpolation, not the actual wire request. It can be a saved definition or a draft. Compare it with the current draft before claiming the draft has changed.`,
              })
            : null,
        assertions: redactAiHttp(
          runtime.value.assertions,
        ) as AiHttpContext['assertions'],
      },
    }
  }
  function apply(
    snapshot: HttpAiSnapshot,
    proposal: AiHttpProposal,
    checkOnly = false,
  ) {
    if (
      !read()
      || baseline() !== snapshot.baseline
      || proposal.context_id !== snapshot.context.contextId
    ) {
      return false
    }
    const parsed = aiHttpProposalSchema.safeParse(proposal)
    if (!parsed.success)
      return false
    const assertions = [...runtime.value.assertions, ...parsed.data.assertions]
    if (!httpRuntimeSchema.safeParse({ ...runtime.value, assertions }).success)
      return false
    if (!checkOnly)
      runtime.value.assertions = JSON.parse(JSON.stringify(assertions))
    return true
  }
  async function action(
    snapshot: HttpAiSnapshot,
    intent: AiHttpAction,
    execute: () => Promise<HttpExecuteResult | undefined>,
  ) {
    if (!read() || baseline() !== snapshot.baseline)
      return false
    if (intent.action === 'send') {
      return Boolean(
        await executeCurrentRequest(async () => {
          const response = await execute()
          if (!response)
            throw new Error('HTTP_EXECUTION_FAILED')
          return response
        }),
      )
    }
    if (intent.action === 'saveDraft')
      return saveRequest()
    if (intent.action === 'discardDraft')
      return discardRequestChanges()
    if (
      intent.action !== 'patchDraft'
      && intent.action !== 'patchAndSend'
      && intent.action !== 'saveAndSend'
    ) {
      return false
    }
    const { runtime: nextRuntime, ...fields } = intent.fields ?? {}
    const normalized = normalizeHttpDraftPatch(
      currentDraft.value!,
      JSON.parse(JSON.stringify(fields)),
      (nextRuntime ?? runtime.value).transport?.encodeUrl
      ?? snapshot.privateDraft?.transport?.encodeUrl
      ?? true,
      runtime.value.transport?.encodeUrl
      ?? snapshot.privateDraft?.transport?.encodeUrl
      ?? true,
    )
    if (nextRuntime)
      runtime.value = httpRuntimeSchema.parse(nextRuntime)
    const { url, query, ...other } = normalized
    Object.assign(currentDraft.value!, other)
    currentDraft.value!.url = url
    if (JSON.stringify(currentDraft.value!.query) !== JSON.stringify(query))
      currentDraft.value!.query = query
    return intent.action === 'saveAndSend' ? saveRequest() : true
  }
  const unregister = useAi().registerHttp(
    read,
    apply,
    action,
    captureSavedExecutionResult,
    useHttpWebSocket().captureAdoption,
  )
  const unregisterWorkspace = useAi().registerWorkspace(() => ({
    space: 'http',
    selectedIds: [...selectedRequestIds.value],
    folderId: httpState.folderId ?? null,
    library: httpState.libraryFilter,
  }))
  onBeforeUnmount(() => {
    unregister()
    unregisterWorkspace()
  })
}
