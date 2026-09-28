import type { HttpRunView } from '~/shared/httpRunner'
import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  runner: {
    open: { value: true },
    view: { value: null as HttpRunView | null },
    preparing: { value: false },
    running: { value: false },
    openRunner: vi.fn(),
    cancelRunner: vi.fn(),
  },
  invoke: vi.fn(),
  push: vi.fn(),
  route: { value: { name: 'http' } },
  collection: { value: { id: 4 } },
  activeTab: { value: 'headers' },
  openFolder: vi.fn(),
  loadHistory: vi.fn(),
  loadRequests: vi.fn(),
}))
vi.mock('@/composables/spaces/http/useHttpCollectionOverview', () => ({
  useHttpCollectionOverview: () => ({
    requests: { value: [] },
    folderIds: { value: new Set([4]) },
    methods: { value: [] },
    recent: { value: [] },
    lastRun: { value: null },
  }),
}))
vi.mock('@/composables/spaces/http/useHttpFolders', () => ({
  useHttpFolders: () => ({
    folders: { value: [] },
    getFolderByIdFromTree: () => ({ id: 4 }),
    openHttpFolder: mock.openFolder,
  }),
}))
vi.mock('@/composables/spaces/http/useHttpHistory', () => ({
  useHttpHistory: () => ({ getHttpHistory: mock.loadHistory }),
}))
vi.mock('@/composables/spaces/http/useHttpRequests', () => ({
  useHttpRequests: () => ({ getAllHttpRequests: mock.loadRequests }),
}))
vi.mock('@/composables/spaces/http/useHttpRunner', () => ({
  useHttpRunner: () => mock.runner,
}))
vi.mock('@/composables/spaces/http/useHttpCollection', () => ({
  useHttpCollection: () => ({
    collection: mock.collection,
    activeTab: mock.activeTab,
  }),
}))
vi.mock('@/electron', () => ({ ipc: { invoke: mock.invoke } }))
vi.mock('@/router', () => ({
  router: { push: mock.push, currentRoute: mock.route },
  RouterName: { httpSpace: 'http' },
}))
const { executeNativeHttpWorkspace } = await import('../nativeHttpWorkspace')
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('nextTick', async () => {})
  mock.activeTab.value = 'headers'
  mock.collection.value = { id: 4 }
  mock.route.value.name = 'http'
  mock.openFolder.mockResolvedValue(true)
  mock.loadHistory.mockResolvedValue(true)
  mock.loadRequests.mockResolvedValue(true)
  mock.runner.openRunner.mockResolvedValue('cancelled')
  mock.runner.running.value = false
  mock.runner.view.value = {
    runId: 'run',
    folderId: 4,
    folderName: 'Collection',
    environmentName: 'private',
    state: 'running',
    steps: [],
  }
})
it('waits for a terminal result instead of reporting cancellation after IPC acceptance', async () => {
  mock.invoke
    .mockResolvedValueOnce({ ...mock.runner.view.value, state: 'running' })
    .mockResolvedValueOnce({ ...mock.runner.view.value, state: 'passed' })
  const result = await executeNativeHttpWorkspace(
    { action: 'httpRunner', command: 'stop' },
    () => true,
  )
  expect(result).toMatchObject({
    status: 'done',
    runner: { state: 'passed', folderId: 4 },
  })
  expect(mock.runner.cancelRunner).toHaveBeenCalledOnce()
  expect(mock.invoke).toHaveBeenCalledTimes(2)
  expect(result.runner).not.toHaveProperty('environmentName')
})
it('does not use the live main runner to stop an already terminal snapshot', async () => {
  mock.runner.view.value!.state = 'cancelled'
  expect(
    await executeNativeHttpWorkspace(
      { action: 'httpRunner', command: 'stop' },
      () => true,
    ),
  ).toMatchObject({ status: 'done', runner: { state: 'cancelled' } })
  expect(mock.invoke).not.toHaveBeenCalled()
})
it('rejects an old same-folder prepared view after native cancellation', async () => {
  mock.runner.view.value!.state = 'ready'
  expect(
    await executeNativeHttpWorkspace(
      { action: 'httpRunner', command: 'open', folderId: 4 },
      () => true,
    ),
  ).toEqual({ status: 'cancelled' })
  expect(mock.push).not.toHaveBeenCalled()
})
it('rejects completion after the current task changes', async () => {
  let current = true
  mock.invoke.mockImplementationOnce(async () => {
    current = false
    return { ...mock.runner.view.value, state: 'cancelled' }
  })
  expect(
    await executeNativeHttpWorkspace(
      { action: 'httpRunner', command: 'stop' },
      () => current,
    ),
  ).toEqual({ status: 'stale' })
})

it('reads the shared collection overview without changing the native selection or route', async () => {
  expect(
    await executeNativeHttpWorkspace(
      { action: 'httpOverview', command: 'read', folderId: 4 },
      () => true,
    ),
  ).toMatchObject({
    status: 'done',
    overview: { folderId: 4, requests: 0, folders: 0, lastRun: null },
  })
  expect(mock.push).not.toHaveBeenCalled()
  expect(mock.openFolder).not.toHaveBeenCalled()
  mock.loadHistory.mockResolvedValueOnce(false)
  expect(
    await executeNativeHttpWorkspace(
      { action: 'httpOverview', command: 'read', folderId: 4 },
      () => true,
    ),
  ).toEqual({ status: 'failed' })
})

it('does not switch the Overview tab when navigation completes after cancellation', async () => {
  let current = true
  mock.push.mockImplementationOnce(async () => {
    current = false
  })
  expect(
    await executeNativeHttpWorkspace(
      { action: 'httpOverview', command: 'open', folderId: 4 },
      () => current,
    ),
  ).toEqual({ status: 'stale' })
  expect(mock.activeTab.value).toBe('headers')
  expect(mock.loadHistory).not.toHaveBeenCalled()
})
