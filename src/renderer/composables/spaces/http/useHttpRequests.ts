import type {
  HttpRequestItemResponse,
  HttpRequestsAdd,
  HttpRequestsQuery,
  HttpRequestsResponse,
  HttpRequestsUpdate,
} from '@/services/api/generated'
import { useContentSort } from '@/composables/useContentSort'
import { useDialog } from '@/composables/useDialog'
import { useDonations } from '@/composables/useDonations'
import { useSonner } from '@/composables/useSonner'
import {
  markPersistedStorageMutation,
  markUserEdit,
} from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { getContiguousSelection } from '@/utils'
import { benchmarkStart } from '@/utils/benchmark'
import { LibraryFilter } from '../../types'
import {
  requestRuntimeDraft,
  requestRuntimeOwner,
} from './requestRuntimeState'
import { httpRuntimeNavigation } from './runtimeNavigation'
import {
  applyQueryToUrl,
  applyUrlToQuery,
  getDisplayUrl,
  getPersistedUrl,
} from './urlQuery'
import { useHttpApp } from './useHttpApp'
import { isSearch, requestsBySearch, searchQuery } from './useHttpSearch'
import { useHttpSettings } from './useHttpSettings'

export type HttpRequestListItem = HttpRequestsResponse[number]
export type HttpRequest = HttpRequestItemResponse

export type HttpRequestDraft = Pick<
  HttpRequest,
  | 'folderId'
  | 'protocol'
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
// Metadata for the unified HTTP navigation tree; the editor keeps its existing scope.
const allRequests = shallowRef<HttpRequestsResponse>([])
const trashRequests = shallowRef<HttpRequestsResponse>([])
export const isRestoreStateBlocked = ref(false)
const currentRequest = shallowRef<HttpRequest | null>(null)
const currentDraft = ref<HttpRequestDraft | null>(null)
const { settings } = useHttpSettings()
function persistedEncodeUrl(request: HttpRequest) {
  return (
    request.runtime?.transport?.encodeUrl
    ?? settings.transport?.encodeUrl
    ?? true
  )
}
const encodeUrl = computed(() => {
  const request = currentRequest.value
  if (!request)
    return settings.transport?.encodeUrl ?? true
  return requestRuntimeOwner.value === `${request.id}:${request.createdAt}`
    ? (requestRuntimeDraft.value.transport?.encodeUrl
      ?? settings.transport?.encodeUrl
      ?? true)
    : persistedEncodeUrl(request)
})

const { highlightedRequestIds, httpState, focusRequestNameInput }
  = useHttpApp()
const { incrementCreated } = useDonations()
const { getContentSortQuery } = useContentSort()

const selectedRequestIds = ref<number[]>(
  httpState.requestId ? [httpState.requestId] : [],
)
const lastSelectedRequestId = ref<number | undefined>(httpState.requestId)
const selectedRequestsForCreate = ref<HttpRequestsResponse>([])

const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: HttpRequestsQuery = {}

  if (isSearch.value && searchQuery.value) {
    query.search = searchQuery.value
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
  const source = getRequestActionSource()
  return (
    source?.filter(request =>
      selectedRequestIds.value.includes(request.id),
    ) || []
  )
})

function getRequestActionSource() {
  const scoped = isSearch.value
    ? (requestsBySearch.value ?? [])
    : requests.value
  return [
    ...new Map(
      [...allRequests.value, ...scoped, ...trashRequests.value].map(
        request => [request.id, request],
      ),
    ).values(),
  ]
}

let treeLoadToken = 0
async function getAllHttpRequests() {
  const token = ++treeLoadToken
  const [active, deleted] = await Promise.all([
    api.httpRequests.getHttpRequests({
      isDeleted: 0,
      ...getContentSortQuery('http'),
    }),
    api.httpRequests.getHttpRequests({
      isDeleted: 1,
      ...getContentSortQuery('http'),
    }),
  ])
  if (token === treeLoadToken) {
    allRequests.value = active.data
    trashRequests.value = deleted.data
  }
}

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

  return (httpState.activePanel === undefined
    || httpState.activePanel === 'request')
  && httpState.requestId !== undefined
    ? [httpState.requestId]
    : []
}

function getActionTargetRequests(
  targetIds: number[],
  fallbackRequest?: HttpRequestListItem,
) {
  const source = getRequestActionSource()
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
    folderId: request.folderId,
    protocol: request.protocol ?? 'http',
    method: request.method,
    url: getDisplayUrl(request.url, query, encodeUrl.value),
    headers: request.headers.map(h => ({ ...h })),
    query,
    bodyType: request.bodyType,
    body: request.body,
    formData: request.formData.map(f => ({ ...f })),
    auth: { ...request.auth },
    description: request.description,
  }
}

let syncingDraft = false

function assignDraft(request: HttpRequest | null) {
  syncingDraft = true
  try {
    currentRequest.value = request
    currentDraft.value = request ? toDraft(request) : null
  }
  finally {
    syncingDraft = false
  }
  syncDraftDisplayUrl()
}

const isCurrentRequestDirty = computed(() => {
  if (!currentRequest.value || !currentDraft.value)
    return false
  return (
    JSON.stringify(toDraft(currentRequest.value))
    !== JSON.stringify({
      ...currentDraft.value,
      url: getDisplayUrl(
        currentDraft.value.url,
        currentDraft.value.query,
        encodeUrl.value,
      ),
    })
  )
})

export async function getHttpRequests(query?: HttpRequestsQuery) {
  const finishBenchmark = benchmarkStart(
    'http',
    'list',
    (query || queryByLibraryOrFolderOrSearch.value).search,
  )
  try {
    const resolvedQuery = {
      ...(query || queryByLibraryOrFolderOrSearch.value),
      ...getContentSortQuery('http'),
    }
    const { data } = await api.httpRequests.getHttpRequests(resolvedQuery)
    if (resolvedQuery.search) {
      requestsBySearch.value = data
    }
    else {
      requests.value = data
    }
    finishBenchmark()
  }
  catch (error) {
    finishBenchmark('error')
    console.error(error)
  }
}

async function refreshHttpRequests() {
  await Promise.all([
    getHttpRequests(queryByLibraryOrFolderOrSearch.value),
    getAllHttpRequests(),
  ])
}

// Список отдаёт только метаданные (без body/description), поэтому полная
// запись выбранного запроса загружается отдельно по id. Токены защищают от
// гонки ответов; у выбора и post-save-обновления они раздельные: иначе
// автосейв предыдущего запроса инвалидировал бы загрузку только что
// выбранного, и редактор показывал бы не тот запрос, что подсвечен в списке.
let selectionRequestToken = 0
let refreshRequestToken = 0

// Пока полная запись едет по id, редактор блокируется оверлеем: ввод в
// этот момент был бы перетёрт пришедшими данными. Видимость с задержкой,
// чтобы на локальном vault ничего не мигало.
const isCurrentRequestLoading = ref(false)
const isCurrentRequestLoadingVisible = ref(false)
const CURRENT_REQUEST_LOADING_VISIBILITY_DELAY_MS = 300
let loadingVisibilityTimer: ReturnType<typeof setTimeout> | undefined

watch(isCurrentRequestLoading, (loading) => {
  if (loading) {
    if (isCurrentRequestLoadingVisible.value || loadingVisibilityTimer) {
      return
    }

    loadingVisibilityTimer = setTimeout(() => {
      loadingVisibilityTimer = undefined

      if (isCurrentRequestLoading.value) {
        isCurrentRequestLoadingVisible.value = true
      }
    }, CURRENT_REQUEST_LOADING_VISIBILITY_DELAY_MS)

    return
  }

  if (loadingVisibilityTimer) {
    clearTimeout(loadingVisibilityTimer)
    loadingVisibilityTimer = undefined
  }
  isCurrentRequestLoadingVisible.value = false
})

async function fetchHttpRequestById(
  requestId: number,
): Promise<HttpRequest | null> {
  try {
    const { data } = await api.httpRequests.getHttpRequestsById(
      String(requestId),
    )
    return data as HttpRequest
  }
  catch (error) {
    console.error(error)
    return null
  }
}

async function loadCurrentRequest(requestId: number, transitionToken: number) {
  const requestToken = ++selectionRequestToken
  isCurrentRequestLoading.value = true

  const finishBenchmark = benchmarkStart('http', 'open')
  try {
    const record = await fetchHttpRequestById(requestId)

    if (
      requestToken !== selectionRequestToken
      || transitionToken !== httpRuntimeNavigation.transitionToken
    ) {
      finishBenchmark('superseded')
      return
    }

    if (httpState.requestId !== requestId) {
      finishBenchmark('superseded')
      return
    }

    // Транзиентный сбой загрузки: выбор откатывается на запись, которая
    // фактически осталась в редакторе, иначе подсвеченный элемент и
    // редактируемая запись разошлись бы, и autosave писал бы правки не в
    // тот запрос. Повторный клик по нужному элементу ретраит загрузку.
    // До первой загрузки (currentRequest ещё null) откатывать некуда:
    // персистентный выбор сохраняется, его доselect'ит refresh после sync.
    if (!record) {
      finishBenchmark('error')
      if (currentRequest.value) {
        const previousId = currentRequest.value.id
        httpState.requestId = previousId
        selectedRequestIds.value = [previousId]
        lastSelectedRequestId.value = previousId
      }
      return
    }

    assignDraft(record)
    finishBenchmark()
  }
  catch (error) {
    finishBenchmark('error')
    throw error
  }
  finally {
    if (requestToken === selectionRequestToken) {
      isCurrentRequestLoading.value = false
    }
  }
}

// Нетронутый draft следует за сохранёнными изменениями метаданных (например,
// folderId при переносе в корзину); реальные правки редактора сохраняются.
async function refreshCurrentRequestRecord(requestId: number) {
  const requestToken = ++refreshRequestToken
  const record = await fetchHttpRequestById(requestId)

  if (
    !record
    || requestToken !== refreshRequestToken
    || currentRequest.value?.id !== requestId
  ) {
    return
  }

  const preserveDraft = isCurrentRequestDirty.value
  if (preserveDraft)
    currentRequest.value = record
  else assignDraft(record)
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
      ...(payload?.protocol && { protocol: payload.protocol }),
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
    // Фокус ставится после фактической смены выбора, а не параллельно ей.
    await selectHttpRequest(id)
    await focusRequestNameInput()
  }
}

async function duplicateHttpRequest(requestId: number) {
  // Полная запись по id: в списке нет body и description.
  const source = await fetchHttpRequestById(requestId)
  if (!source) {
    return
  }

  // Тело pending-запроса ещё не докачано (body: null): копия получилась бы
  // без body и молча разошлась с оригиналом.
  if (
    source.pendingCloudDownload
    || (source.runtimeState && source.runtimeState !== 'ready')
  ) {
    useSonner().sonner({
      id: 'cloud-file-not-ready',
      message: i18n.t('messages:warning.cloudFileNotReady'),
      type: 'warning',
    })
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
      protocol: source.protocol,
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

    if (source.runtime) {
      await api.httpRequests.putHttpRequestsByIdRuntime(String(id), {
        runtime: source.runtime,
        expectedRevision: 'missing',
      })
    }

    await refreshHttpRequests()

    return id
  }
  catch (error) {
    console.error(error)
  }
}

// A rejected write never counts as a successful save.
async function updateHttpRequest(
  requestId: number,
  data: HttpRequestsUpdate,
): Promise<boolean> {
  try {
    markPersistedStorageMutation()
    await api.httpRequests.patchHttpRequestsById(String(requestId), data)
  }
  catch (error) {
    console.error(error)
    return false
  }

  try {
    await refreshHttpRequests()
    if (currentRequest.value?.id === requestId) {
      await refreshCurrentRequestRecord(requestId)
    }
  }
  catch (error) {
    // Сама правка уже сохранена: сбой refresh не делает сохранение неудачным.
    console.error(error)
  }

  return true
}

async function updateHttpRequests(
  requestIds: number[],
  data: HttpRequestsUpdate[],
) {
  try {
    markPersistedStorageMutation()

    // Ошибка одного элемента (например 503 на pending-записи) не прерывает
    // batch: остальные элементы обрабатываются, список обновляется в любом
    // случае, о пропуске сообщает общий 503-тост API-клиента.
    for (const [index, requestId] of requestIds.entries()) {
      try {
        await api.httpRequests.patchHttpRequestsById(
          String(requestId),
          data[index],
        )
      }
      catch (error) {
        console.error(error)
      }
    }

    await refreshHttpRequests()
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteHttpRequest(requestId: number) {
  if (
    currentRequest.value?.id === requestId
    && !(await httpRuntimeNavigation.confirmLeave())
  ) {
    return
  }
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
  if (
    currentRequest.value
    && requestIds.includes(currentRequest.value.id)
    && !(await httpRuntimeNavigation.confirmLeave())
  ) {
    return
  }
  try {
    markPersistedStorageMutation()

    // Ошибка одного элемента (например 503 на pending-записи) не прерывает
    // batch: остальные элементы обрабатываются, список обновляется в любом
    // случае, о пропуске сообщает общий 503-тост API-клиента.
    for (const requestId of requestIds) {
      try {
        await api.httpRequests.deleteHttpRequestsById(String(requestId))
      }
      catch (error) {
        console.error(error)
        continue
      }

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

  if (
    currentRequest.value
    && targetIds.includes(currentRequest.value.id)
    && !(await httpRuntimeNavigation.confirmLeave())
  ) {
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
  if (
    currentRequest.value?.isDeleted
    && !(await httpRuntimeNavigation.confirmLeave())
  ) {
    return
  }
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
    // Сброс идёт через общий поток выбора: правки draft'а сохраняются до
    // assignDraft(null), а при неудачном PATCH сброс отменяется (запись
    // могла просто уйти из текущего фильтра списка).
    selectHttpRequest(undefined)
  }
}

// Возвращает Promise завершения перехода: вызывающие потоки (deep links,
// navigation history, create-and-select, init) могут дождаться фактической
// смены выбора вместо чтения ещё не обновлённого состояния.
export function selectHttpRequest(
  requestId: number | undefined,
  withShift = false,
  options: { preservePanel?: boolean } = {},
): Promise<void> {
  // Расширение выделения shift'ом не меняет открытый draft — выполняется
  // синхронно и без сохранения.
  if (
    withShift
    && requestId !== undefined
    && httpState.requestId !== undefined
    && requests.value.length
  ) {
    const orderedIds = requests.value.map(r => r.id)
    const rangeSelection = getContiguousSelection(
      orderedIds,
      httpState.requestId,
      requestId,
    )

    if (rangeSelection.length) {
      selectedRequestIds.value = rangeSelection
      lastSelectedRequestId.value = requestId
      return Promise.resolve()
    }
  }

  return applyHttpRequestSelection(requestId, options)
}

// Токен перехода взводится ДО первого await: при быстрых кликах A → B → C
// применяется последний клик, а не последний завершившийся PATCH — устаревший
// переход после ожидания сохранения обнаруживает новый токен и отменяется.

async function applyHttpRequestSelection(
  requestId: number | undefined,
  options: { preservePanel?: boolean },
) {
  const transitionToken = ++httpRuntimeNavigation.transitionToken

  if (!(await httpRuntimeNavigation.confirmLeave()))
    return
  if (transitionToken !== httpRuntimeNavigation.transitionToken)
    return

  if (!options.preservePanel)
    httpState.activePanel = 'request'

  if (requestId === undefined) {
    httpState.requestId = undefined
    selectedRequestIds.value = []
    lastSelectedRequestId.value = undefined
    assignDraft(null)
    return
  }

  selectedRequestIds.value = [requestId]
  lastSelectedRequestId.value = requestId
  httpState.requestId = requestId

  await loadCurrentRequest(requestId, transitionToken)
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

// Serialize repeated explicit saves so an older PATCH cannot win the race.
let saveChain: Promise<boolean> = Promise.resolve(true)

export function saveCurrentRequest(): Promise<boolean> {
  const next = saveChain.then(() => performSaveCurrentRequest())
  saveChain = next.catch(() => false)
  return next
}

// Invalid fields and rejected writes retain the draft and block navigation.
async function performSaveCurrentRequest(): Promise<boolean> {
  if (!currentRequest.value || !currentDraft.value)
    return true
  // Autosave пишет только в запись, соответствующую текущему выбору:
  // при расхождении (сбойное переключение, гонка загрузки) сохранение
  // ушло бы не в тот запрос.
  if (httpState.requestId !== currentRequest.value.id)
    return false
  if (!isCurrentRequestDirty.value)
    return true

  const draft = currentDraft.value
  const update: HttpRequestsUpdate = JSON.parse(
    JSON.stringify({
      folderId: draft.folderId,
      protocol: draft.protocol,
      method: draft.method,
      url: getPersistedUrl(draft.url, draft.query),
      headers: draft.headers,
      query: draft.query,
      bodyType: draft.bodyType,
      body: draft.body,
      formData: draft.formData,
      auth: draft.auth,
      description: draft.description,
    }),
  )

  const request = currentRequest.value
  try {
    markPersistedStorageMutation()
    await api.httpRequests.patchHttpRequestsById(String(request.id), update)
  }
  catch (error) {
    console.error(error)
    return false
  }
  // Advance the baseline from the acknowledged payload, not a follow-up GET.
  // A failed refresh must not make a successful save dirty again.
  if (
    currentRequest.value?.id === request.id
    && currentRequest.value.createdAt === request.createdAt
  ) {
    currentRequest.value = { ...currentRequest.value, ...update }
  }
  void refreshHttpRequests().catch(console.error)
  return true
}

function discardCurrentRequestChanges() {
  if (!currentRequest.value)
    return
  assignDraft(currentRequest.value)
}

function syncDraftDisplayUrl() {
  const draft = currentDraft.value
  if (syncingDraft || !draft)
    return
  syncingDraft = true
  try {
    // Changing the transport setting changes how values are interpreted;
    // it must not rewrite the user's literal Params values.
    draft.url = getDisplayUrl(draft.url, draft.query, encodeUrl.value)
  }
  finally {
    syncingDraft = false
  }
}
watch(encodeUrl, syncDraftDisplayUrl, { flush: 'sync' })

watch(
  () => currentDraft.value?.url,
  () => {
    const draft = currentDraft.value
    if (syncingDraft || !draft)
      return
    const next = applyUrlToQuery(draft.url, draft.query, encodeUrl.value)
    if (JSON.stringify(next) !== JSON.stringify(draft.query)) {
      syncingDraft = true
      try {
        draft.query = next
      }
      finally {
        syncingDraft = false
      }
    }
  },
  { flush: 'sync' },
)

watch(
  () => currentDraft.value?.query,
  () => {
    const draft = currentDraft.value
    if (syncingDraft || !draft)
      return
    const next = applyQueryToUrl(draft.url, draft.query, encodeUrl.value)
    if (next !== draft.url) {
      syncingDraft = true
      try {
        draft.url = next
      }
      finally {
        syncingDraft = false
      }
    }
  },
  { deep: true, flush: 'sync' },
)

watch(
  currentDraft,
  () => {
    if (!isCurrentRequestDirty.value)
      return
    markUserEdit()
  },
  { deep: true },
)

function resetHttpRequestsState() {
  treeLoadToken += 1
  allRequests.value = []
  trashRequests.value = []
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
    allRequests,
    trashRequests,
    getAllHttpRequests,
    createHttpRequest,
    createHttpRequestAndSelect,
    currentDraft,
    currentRequest,
    isCurrentRequestLoading,
    isCurrentRequestLoadingVisible,
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
