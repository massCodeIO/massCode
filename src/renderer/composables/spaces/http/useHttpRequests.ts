import type {
  HttpRequestItemResponse,
  HttpRequestsAdd,
  HttpRequestsResponse,
  HttpRequestsUpdate,
} from '@/services/api/generated'
import { useDonations } from '@/composables/useDonations'
import {
  markPersistedStorageMutation,
  markUserEdit,
} from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { getContiguousSelection } from '@/utils'
import { useDebounceFn } from '@vueuse/core'
import { getEntryNameValidationIssue } from '~/shared/entryNameValidation'
import { useHttpApp } from './useHttpApp'
import { isSearch, requestsBySearch, searchQuery } from './useHttpSearch'

const AUTO_SAVE_DEBOUNCE_MS = 500

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

export const requests = shallowRef<HttpRequestsResponse>([])
export const isRestoreStateBlocked = ref(false)
const currentRequest = shallowRef<HttpRequest | null>(null)
const currentDraft = ref<HttpRequestDraft | null>(null)

const { httpState } = useHttpApp()
const { incrementCreated } = useDonations()

const selectedRequestIds = ref<number[]>(
  httpState.requestId ? [httpState.requestId] : [],
)
const lastSelectedRequestId = ref<number | undefined>(httpState.requestId)

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

type HttpQueryItem = HttpRequestDraft['query'][number]

function splitUrl(url: string): {
  path: string
  query: string
  fragment: string
} {
  const hashIdx = url.indexOf('#')
  const fragment = hashIdx === -1 ? '' : url.slice(hashIdx)
  const beforeHash = hashIdx === -1 ? url : url.slice(0, hashIdx)
  const qIdx = beforeHash.indexOf('?')
  const path = qIdx === -1 ? beforeHash : beforeHash.slice(0, qIdx)
  const query = qIdx === -1 ? '' : beforeHash.slice(qIdx + 1)
  return { path, query, fragment }
}

function combineUrl(parts: {
  path: string
  query: string
  fragment: string
}): string {
  return (
    parts.path + (parts.query ? `?${parts.query}` : '') + (parts.fragment || '')
  )
}

function parseQueryString(qs: string): Array<{ key: string, value: string }> {
  if (!qs)
    return []
  return qs.split('&').map((part) => {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1)
      return { key: part, value: '' }
    return { key: part.slice(0, eqIdx), value: part.slice(eqIdx + 1) }
  })
}

function buildQueryString(query: HttpQueryItem[]): string {
  const enabled = query.filter(q => q.enabled !== false && q.key)
  if (!enabled.length)
    return ''
  return enabled.map(q => `${q.key}=${q.value}`).join('&')
}

function applyQueryToUrl(url: string, query: HttpQueryItem[]): string {
  const parts = splitUrl(url)
  return combineUrl({ ...parts, query: buildQueryString(query) })
}

function applyUrlToQuery(
  url: string,
  existingQuery: HttpQueryItem[],
): HttpQueryItem[] {
  const parsed = parseQueryString(splitUrl(url).query)
  const enabledExisting = existingQuery.filter(q => q.enabled !== false)
  const disabledExisting = existingQuery.filter(q => q.enabled === false)

  const next: HttpQueryItem[] = parsed.map((p, i) => {
    const matched = enabledExisting[i]
    return {
      key: p.key,
      value: p.value,
      description: matched?.description ?? '',
      enabled: true,
    }
  })

  return [...next, ...disabledExisting]
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

let skipUrlWatch = false
let skipQueryWatch = false

function assignDraft(request: HttpRequest | null) {
  skipUrlWatch = true
  skipQueryWatch = true
  currentRequest.value = request
  currentDraft.value = request ? toDraft(request) : null
}

const isCurrentRequestDirty = computed(() => {
  if (!currentRequest.value || !currentDraft.value)
    return false
  return (
    JSON.stringify(toDraft(currentRequest.value))
    !== JSON.stringify(currentDraft.value)
  )
})

export async function getHttpRequests(query?: { search?: string }) {
  try {
    const { data } = await api.httpRequests.getHttpRequests(query)
    if (query?.search) {
      requestsBySearch.value = data
    }
    else {
      requests.value = data
    }
  }
  catch (error) {
    console.error(error)
  }
}

async function refreshHttpRequests() {
  if (isSearch.value && searchQuery.value) {
    await getHttpRequests({ search: searchQuery.value })
  }
  else {
    await getHttpRequests()
  }
}

function findHttpRequestById(requestId: number): HttpRequest | null {
  return (
    requestsBySearch.value?.find(r => r.id === requestId)
    ?? requests.value.find(r => r.id === requestId)
    ?? null
  )
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

    incrementCreated('http')
    await refreshHttpRequests()

    return Number(data.id)
  }
  catch (error) {
    console.error(error)
  }
}

async function createHttpRequestAndSelect(payload?: Partial<HttpRequestsAdd>) {
  const id = await createHttpRequest(payload)
  if (id) {
    selectHttpRequest(id)
  }
}

async function duplicateHttpRequest(requestId: number) {
  const source = findHttpRequestById(requestId)
  if (!source) {
    return
  }

  try {
    const folderId = source.folderId ?? null
    const siblingNames = requests.value
      .filter(request => (request.folderId ?? null) === folderId)
      .map(request => request.name)
    const copyBaseName = `${source.name} - copy`
    const name = siblingNames.some(
      sibling => sibling.toLowerCase() === copyBaseName.toLowerCase(),
    )
      ? getNextIndexedName(copyBaseName, siblingNames)
      : copyBaseName

    markPersistedStorageMutation()
    const { data } = await api.httpRequests.postHttpRequests({
      folderId,
      method: source.method,
      name,
      url: source.url,
    })
    const id = Number(data.id)

    await api.httpRequests.patchHttpRequestsById(String(id), {
      auth: { ...source.auth },
      body: source.body,
      bodyType: source.bodyType,
      description: source.description,
      formData: source.formData.map(entry => ({ ...entry })),
      headers: source.headers.map(entry => ({ ...entry })),
      query: source.query.map(entry => ({ ...entry })),
    })

    await refreshHttpRequests()

    return id
  }
  catch (error) {
    console.error(error)
  }
}

async function updateHttpRequest(requestId: number, data: HttpRequestsUpdate) {
  try {
    markPersistedStorageMutation()
    await api.httpRequests.patchHttpRequestsById(String(requestId), data)
    await refreshHttpRequests()
    if (currentRequest.value?.id === requestId) {
      const fresh = findHttpRequestById(requestId)
      if (fresh)
        currentRequest.value = fresh
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
      assignDraft(null)
    }
    await refreshHttpRequests()
  }
  catch (error) {
    console.error(error)
  }
}

export function selectFirstRequest(options?: { folderId?: number | null }) {
  const source = isSearch.value ? requestsBySearch.value || [] : requests.value
  const filteredSource = options
    ? source.filter(
        request => (request.folderId ?? null) === (options.folderId ?? null),
      )
    : source
  const first = filteredSource?.[0]

  if (first) {
    selectHttpRequest(first.id)
  }
  else {
    httpState.requestId = undefined
    selectedRequestIds.value = []
    lastSelectedRequestId.value = undefined
    assignDraft(null)
  }
}

export function selectHttpRequest(
  requestId: number | undefined,
  withShift = false,
) {
  if (requestId === undefined) {
    httpState.requestId = undefined
    selectedRequestIds.value = []
    lastSelectedRequestId.value = undefined
    assignDraft(null)
    return
  }

  if (withShift && httpState.requestId !== undefined && requests.value.length) {
    const orderedIds = requests.value.map(r => r.id)
    const rangeSelection = getContiguousSelection(
      orderedIds,
      httpState.requestId,
      requestId,
    )

    if (rangeSelection.length) {
      selectedRequestIds.value = rangeSelection
      lastSelectedRequestId.value = requestId
      return
    }
  }

  selectedRequestIds.value = [requestId]
  lastSelectedRequestId.value = requestId
  httpState.requestId = requestId

  assignDraft(findHttpRequestById(requestId))
}

function hasSiblingRequestNameConflict(
  name: string,
  excludeId: number,
  folderId: number | null,
): boolean {
  const normalized = name.trim().toLowerCase()
  if (!normalized)
    return false
  return requests.value.some(
    request =>
      request.id !== excludeId
      && (request.folderId ?? null) === (folderId ?? null)
      && request.name.toLowerCase() === normalized,
  )
}

async function saveCurrentRequest() {
  if (!currentRequest.value || !currentDraft.value)
    return
  if (!isCurrentRequestDirty.value)
    return

  const draft = currentDraft.value
  if (getEntryNameValidationIssue(draft.name))
    return
  if (
    hasSiblingRequestNameConflict(
      draft.name,
      currentRequest.value.id,
      draft.folderId,
    )
  ) {
    return
  }

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
  skipUrlWatch = true
  skipQueryWatch = true
  currentDraft.value = toDraft(currentRequest.value)
}

const autoSaveDebounced = useDebounceFn(() => {
  void saveCurrentRequest()
}, AUTO_SAVE_DEBOUNCE_MS)

watch(
  () => currentDraft.value?.url,
  () => {
    if (skipUrlWatch) {
      skipUrlWatch = false
      return
    }
    const draft = currentDraft.value
    if (!draft)
      return
    const next = applyUrlToQuery(draft.url, draft.query)
    if (JSON.stringify(next) !== JSON.stringify(draft.query)) {
      skipQueryWatch = true
      draft.query = next
    }
  },
)

watch(
  () => currentDraft.value?.query,
  () => {
    if (skipQueryWatch) {
      skipQueryWatch = false
      return
    }
    const draft = currentDraft.value
    if (!draft)
      return
    const next = applyQueryToUrl(draft.url, draft.query)
    if (next !== draft.url) {
      skipUrlWatch = true
      draft.url = next
    }
  },
  { deep: true },
)

watch(
  currentDraft,
  () => {
    if (!isCurrentRequestDirty.value)
      return
    markUserEdit()
    autoSaveDebounced()
  },
  { deep: true },
)

function resetHttpRequestsState() {
  requests.value = []
  requestsBySearch.value = undefined
  currentRequest.value = null
  currentDraft.value = null
  selectedRequestIds.value = []
  lastSelectedRequestId.value = undefined
  httpState.requestId = undefined
}

export function useHttpRequests() {
  return {
    createHttpRequest,
    createHttpRequestAndSelect,
    currentDraft,
    currentRequest,
    deleteHttpRequest,
    duplicateHttpRequest,
    discardCurrentRequestChanges,
    getHttpRequests,
    hasSiblingRequestNameConflict,
    isCurrentRequestDirty,
    isRestoreStateBlocked,
    lastSelectedRequestId,
    requests,
    resetHttpRequestsState,
    saveCurrentRequest,
    selectedRequestIds,
    selectFirstRequest,
    selectHttpRequest,
    updateHttpRequest,
  }
}
