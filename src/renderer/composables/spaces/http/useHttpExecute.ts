import type {
  HttpExecutePayload,
  HttpExecuteRequest,
  HttpExecuteResult,
} from '~/main/types/http'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { ipc } from '@/electron'
import { useHttpEnvironments } from './useHttpEnvironments'
import { useHttpRequests } from './useHttpRequests'

export type HttpResponse = HttpExecuteResult

const isExecuting = ref(false)
const lastResponse = shallowRef<HttpResponse | null>(null)
const lastError = ref<string | null>(null)

const { currentDraft, currentRequest } = useHttpRequests()
const { activeEnvironmentId } = useHttpEnvironments()

function buildExecuteRequest(): HttpExecuteRequest | null {
  const draft = currentDraft.value
  if (!draft)
    return null

  return {
    method: draft.method,
    url: draft.url,
    headers: draft.headers.map(h => ({ ...h })),
    query: draft.query.map(q => ({ ...q })),
    bodyType: draft.bodyType,
    body: draft.body,
    formData: draft.formData.map(f => ({ ...f })),
    auth: { ...draft.auth },
  }
}

async function executeCurrentRequest(): Promise<HttpResponse | null> {
  const request = buildExecuteRequest()
  if (!request)
    return null

  const payload: HttpExecutePayload = {
    request,
    requestId: currentRequest.value?.id ?? null,
    environmentId: activeEnvironmentId.value,
  }

  isExecuting.value = true
  lastError.value = null

  try {
    markPersistedStorageMutation()
    const response = (await ipc.invoke(
      'spaces:http:execute',
      payload,
    )) as HttpResponse
    lastResponse.value = response
    if (response.error) {
      lastError.value = response.error
    }
    return response
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    lastError.value = message
    return null
  }
  finally {
    isExecuting.value = false
  }
}

function resetHttpExecuteState() {
  isExecuting.value = false
  lastResponse.value = null
  lastError.value = null
}

export function useHttpExecute() {
  return {
    executeCurrentRequest,
    isExecuting,
    lastError,
    lastResponse,
    resetHttpExecuteState,
  }
}
