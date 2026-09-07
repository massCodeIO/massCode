import { useHttpApp } from './useHttpApp'
import { useHttpEnvironments } from './useHttpEnvironments'
import { useHttpExecute } from './useHttpExecute'
import { useHttpFolders } from './useHttpFolders'
import { useHttpHistory } from './useHttpHistory'
import { useHttpRequests } from './useHttpRequests'
import { useHttpSearch } from './useHttpSearch'

const { httpState, isHttpSpaceInitialized } = useHttpApp()
const {
  getHttpFolders,
  resetHttpFoldersState,
  folders,
  getFolderByIdFromTree,
} = useHttpFolders()
const {
  getHttpRequests,
  getAllHttpRequests,
  requests,
  resetHttpRequestsState,
  selectHttpRequest,
} = useHttpRequests()
const { getHttpEnvironments, resetHttpEnvironmentsState }
  = useHttpEnvironments()
const { getHttpHistory, resetHttpHistoryState } = useHttpHistory()
const { resetHttpExecuteState } = useHttpExecute()
const { resetHttpSearchState } = useHttpSearch()

export function resetHttpSpaceInit() {
  isHttpSpaceInitialized.value = false
}

export function resetHttpSpaceState() {
  resetHttpSpaceInit()
  resetHttpSearchState()
  resetHttpExecuteState()
  resetHttpRequestsState()
  resetHttpFoldersState()
  resetHttpEnvironmentsState()
  resetHttpHistoryState()
}

async function initHttpSpace() {
  if (isHttpSpaceInitialized.value)
    return

  await refreshHttpSpaceFromDisk()
}

async function refreshHttpSpaceFromDisk() {
  const selectedRequestId = httpState.requestId
  const results = await Promise.allSettled([
    getHttpFolders(),
    getHttpRequests(),
    getAllHttpRequests(),
    getHttpEnvironments(),
    getHttpHistory(),
  ])

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('HTTP space init error:', result.reason)
    }
  })

  isHttpSpaceInitialized.value = results.every(
    result => result.status === 'fulfilled',
  )

  if (
    httpState.activePanel === 'environments'
    || httpState.activePanel === 'runner'
  ) {
    return
  }

  if (httpState.activePanel === 'folder') {
    if (!folders.value.length)
      return
    if (getFolderByIdFromTree(folders.value, httpState.folderId ?? null))
      return
    httpState.activePanel = 'request'
  }

  const persistedRequestId = selectedRequestId ?? httpState.requestId
  if (
    persistedRequestId !== undefined
    && requests.value.some(r => r.id === persistedRequestId)
  ) {
    await selectHttpRequest(persistedRequestId, false, { preservePanel: true })
    return
  }

  // Пустой список — это либо реально пустой vault, либо provisional-кэш
  // периода фоновой сверки: сохранённый выбор не сбрасывается (иначе он
  // затёрся бы в store.app и после reconcile не восстановился).
  if (persistedRequestId !== undefined && requests.value.length) {
    await selectHttpRequest(undefined)
  }
}

export function useHttpSpaceInit() {
  return {
    initHttpSpace,
    refreshHttpSpaceFromDisk,
    resetHttpSpaceState,
  }
}
