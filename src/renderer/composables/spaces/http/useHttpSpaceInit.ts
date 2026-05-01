import { useHttpApp } from './useHttpApp'
import { useHttpEnvironments } from './useHttpEnvironments'
import { useHttpFolders } from './useHttpFolders'
import { useHttpHistory } from './useHttpHistory'
import { useHttpRequests } from './useHttpRequests'

const { httpState, isHttpSpaceInitialized } = useHttpApp()
const { getHttpFolders } = useHttpFolders()
const { getHttpRequests, requests, selectHttpRequest } = useHttpRequests()
const { getHttpEnvironments } = useHttpEnvironments()
const { getHttpHistory } = useHttpHistory()

export function resetHttpSpaceInit() {
  isHttpSpaceInitialized.value = false
}

async function initHttpSpace() {
  if (isHttpSpaceInitialized.value)
    return

  const results = await Promise.allSettled([
    getHttpFolders(),
    getHttpRequests(),
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

  const persistedRequestId = httpState.requestId
  if (
    persistedRequestId !== undefined
    && requests.value.some(r => r.id === persistedRequestId)
  ) {
    await selectHttpRequest(persistedRequestId)
  }
}

export function useHttpSpaceInit() {
  return {
    initHttpSpace,
  }
}
