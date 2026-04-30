import type {
  HttpRequestItemResponse,
  HttpRequestsAdd,
  HttpRequestsResponse,
  HttpRequestsUpdate,
} from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { useHttpApp } from './useHttpApp'

export type HttpRequestListItem = HttpRequestsResponse[number]
export type HttpRequest = HttpRequestItemResponse

export type HttpRequestDraft = Pick<
  HttpRequest,
  | 'name'
  | 'folderId'
  | 'method'
  | 'url'
  | 'headers'
  | 'query'
  | 'bodyType'
  | 'body'
  | 'formData'
  | 'auth'
  | 'description'
>

const requests = shallowRef<HttpRequestsResponse>([])
const currentRequest = shallowRef<HttpRequest | null>(null)
const currentDraft = ref<HttpRequestDraft | null>(null)

const renameRequestId = ref<number | null>(null)

const { httpState } = useHttpApp()

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNextIndexedName(baseName: string, existingNames: string[]): string {
  const normalizedBase = baseName.trim()
  const indexedNameRe = new RegExp(
    `^${escapeRegExp(normalizedBase)}(?:\\s+(\\d+))?$`,
    'i',
  )

  let maxIndex = 0
  existingNames.forEach((name) => {
    const match = name.trim().match(indexedNameRe)
    if (!match)
      return
    const index = match[1] ? Number(match[1]) : 0
    if (Number.isFinite(index)) {
      maxIndex = Math.max(maxIndex, index)
    }
  })
  return `${normalizedBase} ${maxIndex + 1}`
}

function getNextUntitledRequestName(folderId: number | null): string {
  const siblingNames = requests.value
    .filter(request => (request.folderId ?? null) === folderId)
    .map(request => request.name)

  return getNextIndexedName(
    i18n.t('spaces.http.untitledRequest'),
    siblingNames,
  )
}

function toDraft(request: HttpRequest): HttpRequestDraft {
  return {
    name: request.name,
    folderId: request.folderId,
    method: request.method,
    url: request.url,
    headers: request.headers.map(h => ({ ...h })),
    query: request.query.map(q => ({ ...q })),
    bodyType: request.bodyType,
    body: request.body,
    formData: request.formData.map(f => ({ ...f })),
    auth: { ...request.auth },
    description: request.description,
  }
}

const isCurrentRequestDirty = computed(() => {
  if (!currentRequest.value || !currentDraft.value)
    return false
  return (
    JSON.stringify(toDraft(currentRequest.value))
    !== JSON.stringify(currentDraft.value)
  )
})

async function getHttpRequests() {
  try {
    const { data } = await api.httpRequests.getHttpRequests()
    requests.value = data
  }
  catch (error) {
    console.error(error)
  }
}

async function getHttpRequestById(
  requestId: number,
): Promise<HttpRequest | null> {
  try {
    const { data } = await api.httpRequests.getHttpRequestsById(
      String(requestId),
    )
    return data
  }
  catch (error) {
    console.error(error)
    return null
  }
}

async function createHttpRequest(payload?: Partial<HttpRequestsAdd>) {
  try {
    const folderId = payload?.folderId ?? null
    const name = payload?.name?.trim() || getNextUntitledRequestName(folderId)

    markPersistedStorageMutation()
    const { data } = await api.httpRequests.postHttpRequests({
      name,
      folderId,
      ...(payload?.method && { method: payload.method }),
      ...(payload?.url !== undefined && { url: payload.url }),
    })

    await getHttpRequests()

    return Number(data.id)
  }
  catch (error) {
    console.error(error)
  }
}

async function createHttpRequestAndSelect(payload?: Partial<HttpRequestsAdd>) {
  const id = await createHttpRequest(payload)
  if (id) {
    await selectHttpRequest(id)
    renameRequestId.value = id
  }
}

async function updateHttpRequest(requestId: number, data: HttpRequestsUpdate) {
  try {
    markPersistedStorageMutation()
    await api.httpRequests.patchHttpRequestsById(String(requestId), data)
    await getHttpRequests()
    if (currentRequest.value?.id === requestId) {
      const fresh = await getHttpRequestById(requestId)
      if (fresh) {
        currentRequest.value = fresh
        currentDraft.value = toDraft(fresh)
      }
    }
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteHttpRequest(requestId: number) {
  try {
    markPersistedStorageMutation()
    await api.httpRequests.deleteHttpRequestsById(String(requestId))
    if (httpState.requestId === requestId) {
      httpState.requestId = undefined
      currentRequest.value = null
      currentDraft.value = null
    }
    await getHttpRequests()
  }
  catch (error) {
    console.error(error)
  }
}

async function selectHttpRequest(requestId: number | undefined) {
  httpState.requestId = requestId

  if (requestId === undefined) {
    currentRequest.value = null
    currentDraft.value = null
    return
  }

  const fresh = await getHttpRequestById(requestId)
  if (fresh) {
    currentRequest.value = fresh
    currentDraft.value = toDraft(fresh)
  }
  else {
    currentRequest.value = null
    currentDraft.value = null
  }
}

async function saveCurrentRequest() {
  if (!currentRequest.value || !currentDraft.value)
    return
  if (!isCurrentRequestDirty.value)
    return

  const draft = currentDraft.value
  const update: HttpRequestsUpdate = {
    name: draft.name,
    folderId: draft.folderId,
    method: draft.method,
    url: draft.url,
    headers: draft.headers,
    query: draft.query,
    bodyType: draft.bodyType,
    body: draft.body,
    formData: draft.formData,
    auth: draft.auth,
    description: draft.description,
  }

  await updateHttpRequest(currentRequest.value.id, update)
}

function discardCurrentRequestChanges() {
  if (!currentRequest.value)
    return
  currentDraft.value = toDraft(currentRequest.value)
}

function resetHttpRequestsState() {
  requests.value = []
  currentRequest.value = null
  currentDraft.value = null
  renameRequestId.value = null
  httpState.requestId = undefined
}

export function useHttpRequests() {
  return {
    createHttpRequest,
    createHttpRequestAndSelect,
    currentDraft,
    currentRequest,
    deleteHttpRequest,
    discardCurrentRequestChanges,
    getHttpRequestById,
    getHttpRequests,
    isCurrentRequestDirty,
    renameRequestId,
    requests,
    resetHttpRequestsState,
    saveCurrentRequest,
    selectHttpRequest,
    updateHttpRequest,
  }
}
