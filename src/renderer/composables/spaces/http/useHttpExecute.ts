import type {
  HttpExecutePayload,
  HttpExecuteRequest,
  HttpExecuteResult,
} from '~/main/types/http'
import { useDonations } from '@/composables/useDonations'
import { useSonner } from '@/composables/useSonner'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n, ipc } from '@/electron'
import { useHttpApp } from './useHttpApp'
import { useHttpEnvironments } from './useHttpEnvironments'
import { useHttpRequests } from './useHttpRequests'
import { useHttpSettings } from './useHttpSettings'

export type HttpResponse = HttpExecuteResult

const isExecuting = ref(false)
const lastResponse = shallowRef<HttpResponse | null>(null)
const lastError = ref<string | null>(null)

const { currentDraft, currentRequest, isCurrentRequestLoading }
  = useHttpRequests()
const { httpState } = useHttpApp()
const { activeEnvironmentId } = useHttpEnvironments()
const { incrementSent } = useDonations()
const { settings } = useHttpSettings()

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
  // Переключение на другой запрос ещё грузит его полную запись:
  // currentRequest/draft в этот момент принадлежат предыдущему запросу
  // (в том числе бессрочно, если GET упал), и execute отправил бы не тот
  // запрос, что подсвечен в списке.
  if (
    isCurrentRequestLoading.value
    || httpState.requestId !== currentRequest.value?.id
  ) {
    return null
  }

  // Тело pending-запроса ещё не докачано из облака: draft содержит
  // body: null, и запрос ушёл бы на реальный сервер с пустым payload.
  // Центральный guard закрывает все пути запуска (кнопка, меню, hotkey).
  if (currentRequest.value?.pendingCloudDownload) {
    useSonner().sonner({
      id: 'cloud-file-not-ready',
      message: i18n.t('messages:warning.cloudFileNotReady'),
      type: 'warning',
    })
    return null
  }

  const request = buildExecuteRequest()
  if (!request)
    return null

  const payload: HttpExecutePayload = {
    request,
    requestId: currentRequest.value?.id ?? null,
    environmentId: activeEnvironmentId.value,
    skipCertificateVerification: settings.skipCertificateVerification,
  }

  isExecuting.value = true
  lastError.value = null
  lastResponse.value = null

  try {
    markPersistedStorageMutation()
    incrementSent('http')
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
