import type { AiSemanticProgress } from '~/shared/aiSemantic'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

Object.assign(globalThis as Record<string, unknown>, { computed, ref })

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/electron', () => ({ ipc: { invoke } }))

const indexing: AiSemanticProgress = {
  source: 'builtin',
  builtin: { state: 'ready' },
  index: { state: 'indexing', done: 1, total: 4 },
}
const idle: AiSemanticProgress = { ...indexing, index: { state: 'idle' } }

async function load() {
  const { useSemanticIndexing } = await import('../useSemanticIndexing')
  return useSemanticIndexing()
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('reveals long indexing after the delay and hides it at once when it ends', async () => {
  const { isVisible, setSemanticIndexingStatus } = await load()
  setSemanticIndexingStatus(indexing)
  expect(isVisible.value).toBe(false)
  expect(vi.getTimerCount()).toBe(1)
  vi.advanceTimersByTime(999)
  expect(isVisible.value).toBe(false)
  vi.advanceTimersByTime(1)
  expect(isVisible.value).toBe(true)
  setSemanticIndexingStatus(idle)
  expect(isVisible.value).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps one timer and the original start across progress events', async () => {
  const { isVisible, setSemanticIndexingStatus } = await load()
  setSemanticIndexingStatus(indexing)
  vi.advanceTimersByTime(600)
  setSemanticIndexingStatus({
    ...indexing,
    index: { state: 'indexing', done: 2, total: 4 },
  })
  expect(vi.getTimerCount()).toBe(1)
  vi.advanceTimersByTime(400)
  expect(isVisible.value).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('drops a short sync without ever showing it', async () => {
  const { isVisible, setSemanticIndexingStatus } = await load()
  setSemanticIndexingStatus(indexing)
  vi.advanceTimersByTime(300)
  setSemanticIndexingStatus(idle)
  vi.advanceTimersByTime(2000)
  expect(isVisible.value).toBe(false)
})

it('ignores the initial status when an event arrived while it was requested', async () => {
  let respond!: (value: unknown) => void
  invoke.mockReturnValueOnce(
    new Promise((resolve) => {
      respond = resolve
    }),
  )
  const { refreshSemanticIndexingStatus, setSemanticIndexingStatus, status }
    = await load()
  const pending = refreshSemanticIndexingStatus()
  expect(invoke).toHaveBeenCalledWith(
    'system:ai:semantic-progress-status',
    null,
  )
  setSemanticIndexingStatus(idle)
  respond({ ok: true, data: indexing })
  await pending
  expect(status.value).toEqual(idle)
})
