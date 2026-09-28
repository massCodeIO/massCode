import type { NativeBridgeResult } from './nativeBridges'
import type { AiNativeAction } from '~/shared/aiNativeActions'
import type { HttpRunView } from '~/shared/httpRunner'
import { useHttpCollectionOverview } from '@/composables/spaces/http/useHttpCollectionOverview'
import { useHttpFolders } from '@/composables/spaces/http/useHttpFolders'
import { useHttpHistory } from '@/composables/spaces/http/useHttpHistory'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { ipc } from '@/electron'
import { router, RouterName } from '@/router'

function runnerReceipt(view: HttpRunView) {
  return {
    runId: view.runId,
    folderId: view.folderId,
    folderName: view.folderName,
    state: view.state,
    steps: view.steps.map(({ requestId, name, state, status, durationMs }) => ({
      requestId,
      name,
      state,
      status,
      durationMs,
    })),
  }
}

export async function executeNativeHttpWorkspace(
  action: Extract<AiNativeAction, { action: 'httpOverview' | 'httpRunner' }>,
  current: () => boolean,
): Promise<NativeBridgeResult> {
  if (!current())
    return { status: 'stale' }
  if (action.action === 'httpOverview') {
    const folders = useHttpFolders()
    if (!folders.getFolderByIdFromTree(folders.folders.value, action.folderId))
      return { status: 'unavailable' }
    if (action.command === 'open') {
      if (!(await folders.openHttpFolder(action.folderId, current)))
        return { status: current() ? 'cancelled' : 'stale' }
      if (!current())
        return { status: 'stale' }
      await router.push({ name: RouterName.httpSpace })
      const { useHttpCollection } = await import(
        '@/composables/spaces/http/useHttpCollection'
      )
      if (
        !current()
        || router.currentRoute.value.name !== RouterName.httpSpace
        || useHttpCollection().collection.value?.id !== action.folderId
      ) {
        return { status: 'stale' }
      }
      useHttpCollection().activeTab.value = 'overview'
      await nextTick()
      if (
        !current()
        || useHttpCollection().collection.value?.id !== action.folderId
        || useHttpCollection().activeTab.value !== 'overview'
      ) {
        return { status: 'stale' }
      }
    }
    const history = useHttpHistory()
    if (!(await useHttpRequests().getAllHttpRequests()))
      return { status: 'stale' }
    if (!(await history.getHttpHistory()))
      return { status: 'failed' }
    if (
      !current()
      || !folders.getFolderByIdFromTree(folders.folders.value, action.folderId)
    ) {
      return { status: 'stale' }
    }
    const data = useHttpCollectionOverview(() => action.folderId)
    return {
      status: 'done',
      overview: {
        folderId: action.folderId,
        requests: data.requests.value.length,
        folders: Math.max(0, data.folderIds.value.size - 1),
        methods: data.methods.value.map(([method, count]) => ({
          method,
          count,
        })),
        recent: data.recent.value.map(item => ({
          id: item.id,
          requestId: item.requestId!,
          name: item.name,
          requestedAt: item.requestedAt,
          status: item.status,
        })),
        lastRun: data.lastRun.value ? runnerReceipt(data.lastRun.value) : null,
      },
    }
  }
  const runner = useHttpRunner()
  if (action.command === 'open') {
    if (!action.folderId || runner.running.value || runner.preparing.value)
      return { status: 'unavailable' }
    const previousRunId = runner.view.value?.runId
    const opened = await runner.openRunner(action.folderId, current)
    if (opened !== 'ready')
      return { status: opened }
    if (!current())
      return { status: 'stale' }
    if (
      !runner.open.value
      || runner.view.value?.runId === previousRunId
      || runner.view.value?.folderId !== action.folderId
      || runner.view.value.state !== 'ready'
    ) {
      return { status: 'cancelled' }
    }
    await router.push({ name: RouterName.httpSpace })
  }
  const view = runner.view.value
  if (!view)
    return { status: 'unavailable' }
  if (
    action.command === 'stop'
    && ['passed', 'failed', 'cancelled'].includes(view.state)
  ) {
    return { status: 'done', runner: runnerReceipt(view) }
  }
  if (action.command === 'stop') {
    if (view.state === 'ready')
      return { status: 'unavailable' }
    const runId = view.runId
    await runner.cancelRunner()
    const deadline = Date.now() + 15000
    while (current() && runner.view.value?.runId === runId) {
      const actual = await ipc.invoke<string, HttpRunView>(
        'spaces:http:run-status',
        runId,
      )
      if (!current() || runner.view.value?.runId !== runId)
        return { status: 'stale' }
      if (['passed', 'failed', 'cancelled'].includes(actual.state)) {
        return { status: 'done', runner: runnerReceipt(actual) }
      }
      if (Date.now() >= deadline)
        return { status: 'failed', runner: runnerReceipt(actual) }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return { status: 'stale' }
  }
  return { status: current() ? 'done' : 'stale', runner: runnerReceipt(view) }
}
