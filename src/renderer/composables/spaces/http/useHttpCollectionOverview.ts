import { useHttpFolders } from './useHttpFolders'
import { flattenFolderTree } from './useHttpFolderTree'
import { useHttpHistory } from './useHttpHistory'
import { useHttpRequests } from './useHttpRequests'
import { useHttpRunner } from './useHttpRunner'

export function useHttpCollectionOverview(id: () => number | undefined) {
  const { folders, getFolderByIdFromTree } = useHttpFolders()
  const collection = computed(() =>
    getFolderByIdFromTree(folders.value, id() ?? null),
  )
  const { allRequests } = useHttpRequests()
  const { history } = useHttpHistory()
  const { view, folderId } = useHttpRunner()
  const folderIds = computed(
    () =>
      new Set(
        collection.value
          ? flattenFolderTree([collection.value]).map(folder => folder.id)
          : [],
      ),
  )
  const requests = computed(() =>
    allRequests.value.filter(
      request =>
        request.folderId !== null
        && folderIds.value.has(request.folderId)
        && !request.isDeleted,
    ),
  )
  const methods = computed(() => {
    const counts = new Map<string, number>()
    requests.value.forEach((request) => {
      const method = request.protocol === 'websocket' ? 'WS' : request.method
      counts.set(method, (counts.get(method) ?? 0) + 1)
    })
    return [...counts].sort(([a], [b]) => a.localeCompare(b))
  })
  const recent = computed(() => {
    const byId = new Map(
      requests.value.map(request => [request.id, request]),
    )
    return history.value
      .filter(item => item.requestId !== null && byId.has(item.requestId))
      .toSorted((a, b) => b.requestedAt - a.requestedAt || b.id - a.id)
      .slice(0, 5)
      .map(item => ({ ...item, name: byId.get(item.requestId!)!.name }))
  })
  const lastRun = computed(() =>
    folderId.value === collection.value?.id
    && view.value
    && ['passed', 'failed', 'cancelled'].includes(view.value.state)
      ? view.value
      : null,
  )
  const passed = computed(
    () =>
      lastRun.value?.steps.filter(step => step.state === 'passed').length
      ?? 0,
  )

  return { folderIds, requests, methods, recent, lastRun, passed }
}
