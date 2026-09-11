import { useHttpApp } from './useHttpApp'
import { useHttpCollection } from './useHttpCollection'
import { useHttpEnvironments } from './useHttpEnvironments'
import { useHttpExecute } from './useHttpExecute'
import { useHttpFolders } from './useHttpFolders'
import { useHttpHistory } from './useHttpHistory'
import { useHttpRequests } from './useHttpRequests'
import { useHttpRuntime } from './useHttpRuntime'
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
  useHttpCollection().reset()
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
    const collection = useHttpCollection()
    if (collection.dirty.value || collection.saving.value)
      return
    if (!folders.value.length)
      return
    if (getFolderByIdFromTree(folders.value, httpState.folderId ?? null))
      return
    httpState.activePanel = 'request'
  }

  // A background sync is not navigation. Keep local edits and in-flight saves
  // instead of opening the leave dialog or replacing the editor draft.
  const { requestDirty, busy } = useHttpRuntime()
  if (requestDirty.value || busy.value)
    return

  const persistedRequestId = httpState.requestId
  if (persistedRequestId !== undefined) {
    await selectHttpRequest(persistedRequestId, false, { preservePanel: true })
  }
}

export function useHttpSpaceInit() {
  return {
    initHttpSpace,
    refreshHttpSpaceFromDisk,
    resetHttpSpaceState,
  }
}
