import type { AiHttpContext, AiHttpProposal } from '~/shared/aiHttp'
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpEnvironments } from '@/composables/spaces/http/useHttpEnvironments'
import { useHttpExecute } from '@/composables/spaces/http/useHttpExecute'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { store } from '@/electron'
import {
  aiHttpProposalSchema,
  httpContextText,
  redactAiHttp,
} from '~/shared/aiHttp'
import { httpRuntimeSchema } from '~/shared/httpRuntime'
import { useAi } from './useAi'

export interface HttpAiSnapshot {
  context: AiHttpContext
  baseline: string
}

export function useHttpAi() {
  const { currentRequest, currentDraft, isCurrentRequestLoading }
    = useHttpRequests()
  const { draft: runtime, busy } = useHttpRuntime()
  const { lastResponse, lastError, lastExecutionRequest, isExecuting }
    = useHttpExecute()
  const { activeEnvironmentId } = useHttpEnvironments()
  const { httpState } = useHttpApp()
  function baseline() {
    return JSON.stringify({
      vault: store.preferences.get('storage.vaultPath'),
      id: currentRequest.value?.id,
      request: currentDraft.value,
      runtime: runtime.value,
      revision: currentRequest.value?.runtimeRevision,
      environment: activeEnvironmentId.value,
      response: lastResponse.value,
      error: lastError.value,
    })
  }
  function read(): HttpAiSnapshot | undefined {
    const request = currentRequest.value
    if (
      !request
      || !currentDraft.value
      || request.protocol === 'websocket'
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
    return {
      baseline: baseline(),
      context: {
        contextId: crypto.randomUUID(),
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
                note: `${availability} Outgoing body bytes are not captured: neither Content-Type nor the configured body proves what body was transmitted. Captured outgoing attempts contain request headers and URLs for each hop, with secrets removed. The first entry is the initial attempt; subsequent entries are followed redirects. The last entry is the last attempted URL (the final response URL only on success). Missing request headers means outgoing header capture is unavailable. An empty list of attempts means capture is unavailable, not that no headers were sent. The draft used for this execution is captured before variable interpolation, not the actual wire request. Compare it with the current draft before claiming the draft has changed.`,
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
  const unregister = useAi().registerHttp(read, apply)
  onBeforeUnmount(unregister)
}
