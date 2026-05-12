import type {
  HttpRequestItemResponse,
  HttpRequestsAdd,
  HttpRequestsQuery,
  HttpRequestsResponse,
  HttpRequestsUpdate,
} from '@/services/api/generated'
import { useDialog } from '@/composables/useDialog'
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
import { LibraryFilter } from '../../types'
import {
  applyQueryToUrl,
  applyUrlToQuery,
  getDisplayUrl,
  getPersistedUrl,
} from './urlQuery'
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

const { highlightedRequestIds, httpState, focusRequestNameInput }
  = useHttpApp()
const { incrementCreated } = useDonations()

const selectedRequestIds = ref<number[]>(
  httpState.requestId ? [httpState.requestId] : [],
)
const lastSelectedRequestId = ref<number | undefined>(httpState.requestId)
const selectedRequestsForCreate = ref<HttpRequestsResponse>([])

const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: HttpRequestsQuery = {}

  if (isSearch.value) {
    query.search = searchQuery.value
    return query
  }

  if (httpState.folderId) {
    query.folderId = httpState.folderId
  }
  else if (httpState.libraryFilter === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (httpState.libraryFilter === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (httpState.libraryFilter === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (httpState.libraryFilter === LibraryFilter.Inbox) {
    query.isInbox = 1
  }

  return query
})

const selectedRequests = computed(() => {
  const source = isSearch.value ? requestsBySearch.value : requests.value
  return (
    source?.filter(request =>
      selectedRequestIds.value.includes(request.id),
    ) || []
  )
})

function getActionTargetIds(fallbackRequestId?: number) {
  const highlightedIds = [...highlightedRequestIds.value]

  if (
    fallbackRequestId !== undefined
    && highlightedRequestIds.value.has(fallbackRequestId)
    && highlightedIds.length > 1
  ) {
    return highlightedIds
  }

  if (
    fallbackRequestId !== undefined
    && selectedRequestIds.value.includes(fallbackRequestId)
  ) {
    return [...selectedRequestIds.value]
  }

  if (fallbackRequestId !== undefined) {
    return [fallbackRequestId]
  }

  if (selectedRequestIds.value.length) {
    return [...selectedRequestIds.value]
  }

  return httpState.requestId !== undefined ? [httpState.requestId] : []
}

function getActionTargetRequests(
  targetIds: number[],
  fallbackRequest?: HttpRequestListItem,
) {
  const source = isSearch.value ? requestsBySearch.value : requests.value
  const targetRequests
    = source?.filter(request => targetIds.includes(request.id)) || []

  if (
    fallbackRequest
    && targetIds.includes(fallbackRequest.id)
    && !targetRequests.some(request => request.id === fallbackRequest.id)
  ) {
    targetRequests.push(fallbackRequest)
  }

  return targetRequests
}

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
  const siblingNames = selectedRequestsForCreate.value
    .filter(request => (request.folderId ?? null) === folderId)
    .map(request => request.name)

  return getNextIndexedName(
    i18n.t('spaces.http.untitledRequest'),
    siblingNames,
  )
}

async function syncRequestsForCreate(folderId: number | null) {
  const query: HttpRequestsQuery = { isDeleted: 0 }
  if (folderId !== null) {
    query.folderId = folderId
  }
  else {
    query.isInbox = 1
  }

  const { data } = await api.httpRequests.getHttpRequests(query)
  selectedRequestsForCreate.value = data
}

function toDraft(request: HttpRequest): HttpRequestDraft {
  const query = request.query.map(q => ({ ...q }))

  return {
    name: request.name,
    folderId: request.folderId,
    method: request.method,
    url: getDisplayUrl(request.url, query),
    headers: request.headers.map(h => ({ ...h })),
    query,
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

export async function getHttpRequests(query?: HttpRequestsQuery) {
  try {
    const resolvedQuery = query || queryByLibraryOrFolderOrSearch.value
    const { data } = await api.httpRequests.getHttpRequests(resolvedQuery)
    if (resolvedQuery.search) {
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
  await getHttpRequests(queryByLibraryOrFolderOrSearch.value)
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
    await syncRequestsForCreate(folderId)
    const name = payload?.name?.trim() || getNextUntitledRequestName(folderId)

    markPersistedStorageMutation()
    const { data } = await api.httpRequests.postHttpRequests({
      name,
      folderId,
      ...(payload?.method && { method: payload.method }),
      ...(payload?.url !== undefined && { url: payload.url }),
    })

    incrementCreated('http')

    if (
      httpState.libraryFilter === LibraryFilter.Trash
      || httpState.libraryFilter === LibraryFilter.Favorites
    ) {
      httpState.libraryFilter = LibraryFilter.All
    }

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
    await focusRequestNameInput()
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

async function updateHttpRequests(
  requestIds: number[],
  data: HttpRequestsUpdate[],
) {
  try {
    markPersistedStorageMutation()

    for (const [index, requestId] of requestIds.entries()) {
      await api.httpRequests.patchHttpRequestsById(
        String(requestId),
        data[index],
      )
    }

    await refreshHttpRequests()
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

async function deleteHttpRequests(requestIds: number[]) {
  try {
    markPersistedStorageMutation()

    for (const requestId of requestIds) {
      await api.httpRequests.deleteHttpRequestsById(String(requestId))
      if (httpState.requestId === requestId) {
        httpState.requestId = undefined
        assignDraft(null)
      }
    }

    await refreshHttpRequests()
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteSelectedHttpRequests(
  fallbackRequest?: HttpRequestListItem,
) {
  const { confirm } = useDialog()
  const targetIds = getActionTargetIds(fallbackRequest?.id)

  if (!targetIds.length) {
    return
  }

  const targetRequests = getActionTargetRequests(targetIds, fallbackRequest)

  if (targetIds.length > 1) {
    const isAllSoftDeleted
      = targetRequests.length === targetIds.length
        && targetRequests.every(request => request.isDeleted)

    if (isAllSoftDeleted) {
      const isConfirmed = await confirm({
        title: i18n.t('messages:confirm.deleteConfirmMultipleSnippets', {
          count: targetIds.length,
        }),
        content: i18n.t('messages:warning.noUndo'),
      })

      if (isConfirmed) {
        await deleteHttpRequests(targetIds)
        selectFirstRequest()
      }
    }
    else {
      const requestsData = targetIds.map(() => ({
        folderId: null,
        isDeleted: 1,
      }))

      await updateHttpRequests(targetIds, requestsData)
      selectFirstRequest()
    }

    return
  }

  const targetRequest = targetRequests[0]

  if (!targetRequest) {
    return
  }

  if (!targetRequest.isDeleted) {
    await updateHttpRequest(targetRequest.id, {
      folderId: null,
      isDeleted: 1,
    })

    if (httpState.requestId === targetRequest.id) {
      selectFirstRequest()
    }

    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.deletePermanently', {
      name: targetRequest.name,
    }),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed) {
    return
  }

  const wasSelected = httpState.requestId === targetRequest.id

  await deleteHttpRequest(targetRequest.id)

  if (wasSelected) {
    selectFirstRequest()
  }
}

async function emptyTrash() {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.emptyTrash'),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed)
    return

  try {
    markPersistedStorageMutation()
    await api.httpRequests.deleteHttpRequestsTrash()
    await refreshHttpRequests()
    selectFirstRequest()
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
    url: getPersistedUrl(draft.url, draft.query),
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
    deleteHttpRequests,
    deleteSelectedHttpRequests,
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
    selectedRequests,
    selectFirstRequest,
    selectHttpRequest,
    updateHttpRequest,
    updateHttpRequests,
    emptyTrash,
  }
}
