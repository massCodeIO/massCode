import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  vault: '/vault',
  invoke: vi.fn(),
  refresh: vi.fn(),
  selected: vi.fn(),
  mark: vi.fn(),
}))
vi.mock('@/electron', () => ({
  ipc: { invoke: mock.invoke },
  store: { preferences: { get: () => mock.vault } },
}))
vi.mock('@/composables/spaces/notes/useNotes', () => ({
  useNotes: () => ({
    getNotes: mock.refresh,
    refreshSelectedNote: mock.selected,
    selectedNoteRecordStatus: { value: 'ready' },
  }),
}))
vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation: mock.mark,
}))
const { undoNativeTasksCleanup } = await import('../nativeTasksCleanup')
beforeEach(() => {
  vi.clearAllMocks()
  mock.vault = '/vault'
  mock.refresh.mockResolvedValue(true)
})
it('marks a complete inverse as consumed even when native refresh fails', async () => {
  mock.invoke.mockResolvedValue({ undone: true, restored: 1, conflicts: [] })
  mock.refresh.mockResolvedValue(false)
  const receipt = {
    kind: 'tasksCleanup' as const,
    id: 'private',
    vault: '/vault',
    undone: false,
  }
  expect(await undoNativeTasksCleanup(receipt)).toEqual([
    'tasksCleanupRefresh',
  ])
  expect(receipt.undone).toBe(true)
  expect(mock.mark).toHaveBeenCalledOnce()
})
it('retains unresolved IDs for retry and refuses another vault', async () => {
  mock.invoke.mockResolvedValue({
    undone: false,
    restored: 1,
    conflicts: ['note:2'],
  })
  const receipt = {
    kind: 'tasksCleanup' as const,
    id: 'private',
    vault: '/vault',
    undone: false,
  }
  expect(await undoNativeTasksCleanup(receipt)).toEqual(['note:2'])
  expect(receipt.undone).toBe(false)
  mock.vault = '/other'
  expect(await undoNativeTasksCleanup(receipt)).toEqual(['tasksCleanup'])
  expect(mock.invoke).toHaveBeenCalledOnce()
})
