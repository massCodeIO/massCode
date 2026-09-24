import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  vault: '/vault',
  records: new Map<
    number,
    {
      id: number
      name: string
      folderId: number | null
      isDeleted: number
      content: string
      description: string
      properties: { type: string, status: string }
    }
  >(),
  folders: new Set([9]),
  failId: 0,
  update: vi.fn(),
  stamp: vi.fn(),
}))
vi.mock('../store', () => ({
  store: { app: { set: mock.stamp }, preferences: { get: () => 'never' } },
}))
vi.mock('../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => mock.vault,
}))
vi.mock('../storage', () => ({
  useNotesStorage: () => ({
    folders: { getFolders: () => [...mock.folders].map(id => ({ id })) },
    notes: {
      getNotes: (query: {
        isDeleted?: number
        propertyType?: string
        propertyStatus?: string
      }) =>
        [...mock.records.values()]
          .filter(
            note =>
              note.isDeleted === (query.isDeleted ?? 0)
              && (!query.propertyType
                || note.properties.type === query.propertyType)
              && (!query.propertyStatus
                || note.properties.status === query.propertyStatus),
          )
          .map(note => ({
            ...structuredClone(note),
            folder: note.folderId === null ? null : { id: note.folderId },
          })),
      getNoteById: (id: number) => {
        const note = mock.records.get(id)
        return note
          ? {
              ...structuredClone(note),
              folder: note.folderId === null ? null : { id: note.folderId },
            }
          : null
      },
      updateNote: mock.update,
    },
  }),
}))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mock.vault = '/vault'
  mock.folders = new Set([9])
  mock.failId = 0
  mock.records = new Map(
    [1, 2].map(id => [
      id,
      {
        id,
        name: `Task ${id}`,
        folderId: id === 1 ? 9 : null,
        isDeleted: 0,
        content: 'before',
        description: 'before',
        properties: { type: 'task', status: 'done' },
      },
    ]),
  )
  mock.update.mockImplementation((id, fields) => {
    if (id === mock.failId)
      throw new Error('write failed')
    const note = mock.records.get(id)
    if (!note)
      return { notFound: true, invalidInput: false }
    Object.assign(note, fields)
    return { notFound: false, invalidInput: false }
  })
})
it('undoes only cleanup positions, preserves later edits and keeps the factual run stamp', async () => {
  const { runTasksCleanupWithUndo, undoTasksCleanup } = await import(
    '../tasks'
  )
  const result = runTasksCleanupWithUndo('/vault')
  expect(result).toMatchObject({ status: 'done', count: 2 })
  const note = mock.records.get(1)!
  note.content = 'manual content'
  note.description = 'manual description'
  note.properties.status = 'active'
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: true,
    restored: 2,
    conflicts: [],
  })
  expect(note).toMatchObject({
    folderId: 9,
    isDeleted: 0,
    content: 'manual content',
    description: 'manual description',
    properties: { status: 'active' },
  })
  expect(
    mock.update.mock.calls.every(
      ([, fields]) =>
        Object.keys(fields).sort().join(',') === 'folderId,isDeleted',
    ),
  ).toBe(true)
  expect(mock.stamp).toHaveBeenCalledOnce()
  expect(mock.stamp).toHaveBeenCalledWith(
    'notes.lastTasksCleanupAt',
    expect.any(Number),
  )
  const writes = mock.update.mock.calls.length
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: true,
    restored: 0,
    conflicts: [],
  })
  expect(mock.update).toHaveBeenCalledTimes(writes)
})
it('retains successfully changed IDs after cleanup partially fails', async () => {
  const { runTasksCleanupWithUndo, undoTasksCleanup } = await import(
    '../tasks'
  )
  mock.failId = 2
  const result = runTasksCleanupWithUndo('/vault')
  expect(result).toMatchObject({
    status: 'failed',
    count: 1,
    receiptId: expect.any(String),
  })
  expect(mock.records.get(2)?.isDeleted).toBe(0)
  mock.failId = 0
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: true,
    restored: 1,
    conflicts: [],
  })
})
it.each(['missing', 'folder', 'restored', 'moved'])(
  'retains %s conflicts while undoing unaffected tasks',
  async (kind) => {
    const { runTasksCleanupWithUndo, undoTasksCleanup } = await import(
      '../tasks'
    )
    const result = runTasksCleanupWithUndo('/vault')
    if (kind === 'missing')
      mock.records.delete(1)
    if (kind === 'folder')
      mock.folders.delete(9)
    if (kind === 'restored')
      mock.records.get(1)!.isDeleted = 0
    if (kind === 'moved')
      mock.records.get(1)!.folderId = 8
    expect(undoTasksCleanup(result.receiptId!)).toEqual({
      undone: false,
      restored: 1,
      conflicts: ['note:1'],
    })
    expect(undoTasksCleanup(result.receiptId!)).toEqual({
      undone: false,
      restored: 0,
      conflicts: ['note:1'],
    })
  },
)
it('rejects another vault and retries only unresolved failed inverses', async () => {
  const { runTasksCleanupWithUndo, undoTasksCleanup } = await import(
    '../tasks'
  )
  expect(runTasksCleanupWithUndo('/other')).toEqual({
    status: 'stale',
    count: 0,
  })
  const result = runTasksCleanupWithUndo('/vault')
  mock.vault = '/other'
  expect(undoTasksCleanup(result.receiptId!).undone).toBe(false)
  mock.vault = '/vault'
  mock.failId = 2
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: false,
    restored: 1,
    conflicts: ['note:2'],
  })
  mock.failId = 0
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: true,
    restored: 1,
    conflicts: [],
  })
})
