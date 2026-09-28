import { loadNotesGraphIfNeeded } from '@/components/notes/graph/loader'
import { beforeEach, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'

const mock = vi.hoisted(() => ({ vault: 'one', fetch: vi.fn() }))
vi.mock('@/electron', () => ({
  store: { preferences: { get: () => mock.vault } },
}))
vi.mock('@/services/api', () => ({
  api: { notes: { getNotesGraph: mock.fetch } },
}))
vi.mock('@/router', () => ({ router: {}, RouterName: {} }))
Object.assign(globalThis, { ref, shallowRef })
function deferred() {
  let resolve!: (value: any) => void
  let reject!: (error: Error) => void
  const promise = new Promise<any>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  vi.resetModules()
  mock.vault = 'one'
  mock.fetch.mockReset()
})
it.each(['mount-first', 'action-first'])(
  'coalesces concurrent graph loads (%s) and refreshes after completion',
  async (order) => {
    const { useNotesGraph } = await import('../useNotesGraph')
    const graph = useNotesGraph()
    const read = deferred()
    mock.fetch
      .mockReturnValueOnce(read.promise)
      .mockResolvedValueOnce({ data: { nodes: [{ id: 2 }] } })
    if (order === 'mount-first')
      loadNotesGraphIfNeeded(graph.graphData.value, graph.getNotesGraph)
    const first = graph.getNotesGraph()
    if (order === 'action-first')
      loadNotesGraphIfNeeded(graph.graphData.value, graph.getNotesGraph)
    expect(graph.getNotesGraph()).toBe(first)
    expect(mock.fetch).toHaveBeenCalledOnce()
    expect(graph.isGraphLoading.value).toBe(true)
    read.resolve({ data: { nodes: [{ id: 1 }] } })
    await first
    expect(graph.isGraphLoading.value).toBe(false)
    await graph.getNotesGraph()
    expect(mock.fetch).toHaveBeenCalledTimes(2)
    expect(graph.graphData.value?.nodes).toEqual([{ id: 2 }])
  },
)
it('waits for an old read then fetches fresh data for storage sync', async () => {
  const { useNotesGraph } = await import('../useNotesGraph')
  const graph = useNotesGraph()
  const old = deferred()
  const fresh = deferred()
  mock.fetch
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(fresh.promise)
  const initial = graph.getNotesGraph()
  const synced = graph.getNotesGraph({ fresh: true })
  expect(mock.fetch).toHaveBeenCalledOnce()
  old.resolve({ data: { nodes: [] } })
  await initial
  await Promise.resolve()
  expect(mock.fetch).toHaveBeenCalledTimes(2)
  expect(graph.isGraphLoading.value).toBe(true)
  fresh.resolve({ data: { nodes: [{ id: 1127 }] } })
  await synced
  expect(graph.graphData.value?.nodes).toEqual([{ id: 1127 }])
})
it('does not publish a stale vault response or clear the new vault loading state', async () => {
  const { useNotesGraph } = await import('../useNotesGraph')
  const graph = useNotesGraph()
  const old = deferred()
  const next = deferred()
  mock.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
  const first = graph.getNotesGraph()
  mock.vault = 'two'
  const second = graph.getNotesGraph()
  old.resolve({ data: { nodes: [{ id: 1 }] } })
  await first
  expect(graph.graphData.value).toBeNull()
  expect(graph.isGraphLoading.value).toBe(true)
  next.resolve({ data: { nodes: [{ id: 2 }] } })
  await second
  expect(graph.graphData.value?.nodes).toEqual([{ id: 2 }])
})
it('recovers from an error on the next normal load', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const { useNotesGraph } = await import('../useNotesGraph')
    const graph = useNotesGraph()
    mock.fetch
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { nodes: [] } })
    await graph.getNotesGraph()
    expect(graph.graphError.value).toBe('offline')
    expect(graph.isGraphLoading.value).toBe(false)
    await graph.getNotesGraph()
    expect(graph.graphError.value).toBeNull()
    expect(graph.graphData.value?.nodes).toEqual([])
  }
  finally {
    log.mockRestore()
  }
})

it('discards old-vault completion even when no replacement request has started', async () => {
  const { useNotesGraph } = await import('../useNotesGraph')
  const graph = useNotesGraph()
  const read = deferred()
  mock.fetch.mockReturnValueOnce(read.promise)
  const pending = graph.getNotesGraph()
  mock.vault = 'two'
  read.resolve({ data: { nodes: [{ id: 1 }] } })
  await pending
  expect(graph.graphData.value).toBeNull()
  expect(graph.isGraphLoading.value).toBe(false)
})
