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
  }
  catch (error) {
    console.error(error)
  }
}

async function refreshHttpRequests() {
  await getHttpRequests(queryByLibraryOrFolderOrSearch.value)
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

async function loadCurrentRequest(requestId: number) {
  const requestToken = ++selectionRequestToken
  isCurrentRequestLoading.value = true

  try {
    const record = await fetchHttpRequestById(requestId)

    if (requestToken !== selectionRequestToken) {
      return
    }

    if (httpState.requestId !== requestId) {
      return
    }

    // Транзиентный сбой загрузки: выбор откатывается на запись, которая
    // фактически осталась в редакторе, иначе подсвеченный элемент и
    // редактируемая запись разошлись бы, и autosave писал бы правки не в
    // тот запрос. Повторный клик по нужному элементу ретраит загрузку.
    if (!record) {
      const previousId = currentRequest.value?.id
      httpState.requestId = previousId
      selectedRequestIds.value = previousId !== undefined ? [previousId] : []
      lastSelectedRequestId.value = previousId
      return
    }

    assignDraft(record)
  }
  finally {
    if (requestToken === selectionRequestToken) {
      isCurrentRequestLoading.value = false
    }
  }
}

// Обновляет только currentRequest (без переустановки draft): вызывающие
// потоки сохраняют набранные в редакторе, но ещё не сохранённые правки.
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

  currentRequest.value = record
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
  if (source.pendingCloudDownload) {
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

// Возвращает false при неудачном PATCH: вызывающие потоки (переключение
// выбора) не должны считать несохранённую правку сохранённой.
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

  return applyHttpRequestSelection(requestId)
}

// Токен перехода взводится ДО первого await: при быстрых кликах A → B → C
// применяется последний клик, а не последний завершившийся PATCH — устаревший
// переход после ожидания сохранения обнаруживает новый токен и отменяется.
let selectionTransitionToken = 0

async function applyHttpRequestSelection(requestId: number | undefined) {
  const transitionToken = ++selectionTransitionToken

  // Незасейвленные правки текущего draft'а сохраняются ДО смены выбора,
  // с ожиданием результата: при неудачном PATCH (503 на pending, сеть)
  // переключение отменяется и правки остаются в редакторе — иначе загрузка
  // новой записи уничтожила бы несохранённый draft. Заодно исключается
  // параллельный бег PATCH и GET при повторном клике по той же записи.
  // О причине отказа сообщает общий 503-тост API-клиента.
  if (!(await saveCurrentRequest())) {
    return
  }

  if (transitionToken !== selectionTransitionToken) {
    return
  }

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

  await loadCurrentRequest(requestId)
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

// Сохранения сериализуются одной цепочкой: forced save (переключение выбора)
// и debounced autosave не должны выполняться параллельно — поздний PATCH со
// старым payload перезаписал бы более свежий. Каждое звено перечитывает
// dirty-состояние в момент своего выполнения, поэтому дубли схлопываются в
// no-op.
let saveChain: Promise<boolean> = Promise.resolve(true)

export function saveCurrentRequest(): Promise<boolean> {
  const next = saveChain.then(() => performSaveCurrentRequest())
  saveChain = next.catch(() => false)
  return next
}

// false — только когда PATCH реально выполнялся и не удался: правка НЕ
// сохранена, и уничтожать draft нельзя. Пропуски (чистый draft, невалидное
// имя, несоответствие выбора) возвращают true — там сохранять нечего.
async function performSaveCurrentRequest(): Promise<boolean> {
  if (!currentRequest.value || !currentDraft.value)
    return true
  // Autosave пишет только в запись, соответствующую текущему выбору:
  // при расхождении (сбойное переключение, гонка загрузки) сохранение
  // ушло бы не в тот запрос.
  if (httpState.requestId !== currentRequest.value.id)
    return true
  if (!isCurrentRequestDirty.value)
    return true

  const draft = currentDraft.value
  if (getEntryNameValidationIssue(draft.name))
    return true
  if (
    hasSiblingRequestNameConflict(
      draft.name,
      currentRequest.value.id,
      draft.folderId,
    )
  ) {
    return true
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

  return updateHttpRequest(currentRequest.value.id, update)
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
