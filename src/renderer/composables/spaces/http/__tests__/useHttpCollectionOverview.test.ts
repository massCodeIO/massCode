import { expect, it, vi } from 'vitest'
import { computed } from 'vue'

Object.assign(globalThis, { computed })
const mock = vi.hoisted(() => ({
  folder: { id: 4, children: [{ id: 5, children: [] }] },
  requests: {
    value: [
      { id: 1, folderId: 4, method: 'GET', name: 'One', isDeleted: 0 },
      {
        id: 2,
        folderId: 5,
        method: 'GET',
        protocol: 'websocket',
        name: 'Two',
        isDeleted: 0,
      },
      { id: 3, folderId: 4, method: 'POST', name: 'Deleted', isDeleted: 1 },
      { id: 4, folderId: 9, method: 'GET', name: 'Outside', isDeleted: 0 },
    ],
  },
  history: {
    value: [
      { id: 10, requestId: 1, requestedAt: 100 },
      { id: 11, requestId: 2, requestedAt: 200 },
      { id: 12, requestId: 4, requestedAt: 300 },
    ],
  },
  folderId: { value: 4 },
  view: {
    value: {
      runId: 'run',
      folderId: 4,
      state: 'passed',
      steps: [{ state: 'passed' }],
    },
  },
}))
vi.mock('../useHttpFolders', () => ({
  useHttpFolders: () => ({
    folders: { value: [mock.folder] },
    getFolderByIdFromTree: (_tree: unknown, id: number) =>
      id === 4 ? mock.folder : null,
  }),
}))
vi.mock('../useHttpRequests', () => ({
  useHttpRequests: () => ({ allRequests: mock.requests }),
}))
vi.mock('../useHttpHistory', () => ({
  useHttpHistory: () => ({ history: mock.history }),
}))
vi.mock('../useHttpRunner', () => ({
  useHttpRunner: () => ({ view: mock.view, folderId: mock.folderId }),
}))
const { useHttpCollectionOverview } = await import(
  '../useHttpCollectionOverview'
)
it('shares native subtree counts, recent order and exact collection run association', () => {
  const data = useHttpCollectionOverview(() => 4)
  expect(data.folderIds.value.size).toBe(2)
  expect(data.requests.value.map(item => item.id)).toEqual([1, 2])
  expect(data.methods.value).toEqual([
    ['GET', 1],
    ['WS', 1],
  ])
  expect(data.recent.value.map(item => item.id)).toEqual([11, 10])
  expect(data.lastRun.value?.runId).toBe('run')
  expect(data.passed.value).toBe(1)
  mock.folderId.value = 8
  const other = useHttpCollectionOverview(() => 4)
  expect(other.lastRun.value).toBeNull()
})
