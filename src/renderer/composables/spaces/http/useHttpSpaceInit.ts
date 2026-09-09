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
  allRequests,
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
  const selection = {
    requestId: httpState.requestId,
    folderId: httpState.folderId,
    activePanel: httpState.activePanel,
  }
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
    selection.requestId !== httpState.requestId
    || selection.folderId !== httpState.folderId
    || selection.activePanel !== httpState.activePanel
  ) {
    return
  }

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

  const persistedRequestId = httpState.requestId
  if (
    persistedRequestId !== undefined
    && allRequests.value.some(r => r.id === persistedRequestId)
  ) {
    await selectHttpRequest(persistedRequestId, false, { preservePanel: true })
    return
  }

  // Пустой список — это либо реально пустой vault, либо provisional-кэш
  // периода фоновой сверки: сохранённый выбор не сбрасывается (иначе он
  // затёрся бы в store.app и после reconcile не восстановился).
  if (persistedRequestId !== undefined && allRequests.value.length) {
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
