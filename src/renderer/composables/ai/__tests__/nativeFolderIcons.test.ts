import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  vault: null as string | null,
  invoke: vi.fn(),
  refresh: vi.fn(),
  mark: vi.fn(),
}))
vi.mock('@/electron', () => ({
  ipc: { invoke: mock.invoke },
  store: { preferences: { get: () => mock.vault } },
}))
vi.mock('@/components/ui/folder-icon/icons', () => ({
  getFilteredFolderIcons: () => [],
  resolveFolderIcon: () => true,
}))
vi.mock('@/composables/useFolders', () => ({
  useFolders: () => ({ getFolders: mock.refresh }),
}))
vi.mock('@/composables/spaces/notes/useNoteFolders', () => ({
  useNoteFolders: () => ({ getNoteFolders: mock.refresh }),
}))
vi.mock('@/composables/spaces/http/useHttpFolders', () => ({
  useHttpFolders: () => ({ getHttpFolders: mock.refresh }),
}))
vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation: mock.mark,
}))
const { executeFolderIconAction, undoNativeFolderIcon } = await import(
  '../nativeFolderIcons'
)
beforeEach(() => {
  vi.clearAllMocks()
  mock.vault = null
  mock.refresh.mockResolvedValue(true)
})
it('completes and undoes a default-vault folder icon when the preference is null', async () => {
  mock.invoke.mockResolvedValueOnce({ status: 'done', receiptId: 'receipt' })
  const result = await executeFolderIconAction(
    {
      action: 'folderIcon',
      space: 'code',
      folderId: 1,
      choice: { kind: 'icon', value: null },
    },
    () => true,
  )
  expect(result).toMatchObject({
    status: 'done',
    mutation: { kind: 'folderIcon', id: 'receipt', vault: '' },
  })
  expect(mock.invoke).toHaveBeenCalledWith(
    'fs:folder-icon:change',
    expect.objectContaining({ vault: '' }),
  )
  if (result.status !== 'done' || !('mutation' in result))
    throw new Error('mutation expected')
  mock.invoke.mockResolvedValueOnce({ undone: true })
  expect(await undoNativeFolderIcon(result.mutation as any)).toEqual([])
  expect(mock.invoke).toHaveBeenLastCalledWith('fs:folder-icon:undo', {
    id: 'receipt',
  })
})
