import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ patch: vi.fn() }))
vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation: vi.fn(),
}))
vi.mock('@/utils', () => ({ isRetriableSaveError: () => false }))
vi.mock('~/renderer/services/api', () => ({
  api: { notes: { patchNotesByIdContent: mock.patch } },
}))
vi.mock('../useNotes', () => ({
  notes: { value: [] },
  selectedNoteRecord: { value: undefined },
}))
vi.mock('../useNoteSearch', () => ({ notesBySearch: { value: [] } }))
beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

it('waits for the in-flight save and newer edits before allowing navigation', async () => {
  let finish!: () => void
  mock.patch
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue(undefined)
  const { updateNoteContent, flushNoteContent } = (
    await import('../useNoteContent')
  ).useNoteContent()
  updateNoteContent(1, 'before')
  await vi.advanceTimersByTimeAsync(500)
  updateNoteContent(1, 'after [[note:9|Planned]]')
  const done = vi.fn()
  const flush = flushNoteContent(1).then(done)
  await Promise.resolve()
  expect(done).not.toHaveBeenCalled()
  finish()
  await flush
  expect(mock.patch.mock.calls).toEqual([
    ['1', { content: 'before' }],
    ['1', { content: 'after [[note:9|Planned]]' }],
  ])
  expect(done).toHaveBeenCalledOnce()
})
it('keeps a rejected draft queued so explicit retry saves it', async () => {
  const error = new Error('SAVE_FAILED')
  mock.patch.mockRejectedValueOnce(error).mockResolvedValue(undefined)
  const { updateNoteContent, flushNoteContent } = (
    await import('../useNoteContent')
  ).useNoteContent()
  updateNoteContent(1, 'draft')
  await expect(flushNoteContent(1)).rejects.toBe(error)
  await flushNoteContent(1)
  expect(mock.patch).toHaveBeenCalledTimes(2)
  expect(mock.patch).toHaveBeenLastCalledWith('1', { content: 'draft' })
})
