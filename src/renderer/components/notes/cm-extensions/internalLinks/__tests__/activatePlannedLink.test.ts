import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activatePlannedLink } from '../activatePlannedLink'

const mock = vi.hoisted(() => ({
  flush: vi.fn(),
  open: vi.fn(),
  notify: vi.fn(),
  factory: vi.fn(),
  folder: vi.fn(),
  noteFocus: vi.fn(),
  snippetFocus: vi.fn(),
  httpFocus: vi.fn(),
  selectedId: 9,
  domChanged: () => {},
}))
vi.mock('@/composables/spaces/notes/useNoteContent', () => ({
  useNoteContent: () => ({ flushNoteContent: mock.flush }),
}))
vi.mock('@/composables/useSonner', () => ({
  useSonner: () => ({ sonner: mock.notify }),
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('@/ipc/listeners/deepLinks', () => ({ openInternalTarget: mock.open }))
vi.mock('../createPlannedTarget', () => ({
  createNoteOperation: mock.factory,
  createSnippetOperation: mock.factory,
  createHttpRequestOperation: mock.factory,
  getPlannedHttpCollection: mock.folder,
}))
function source() {
  return {
    noteId: 7,
    valid: vi.fn(() => true),
    insert: vi.fn(),
    release: vi.fn(),
    lock: () => vi.fn(),
    focus: vi.fn(),
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.selectedId = 9
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        mock.domChanged = callback
      }

      observe() {}
      disconnect() {}
    },
  )
  const dom: any = {
    body: {},
    activeElement: null,
    querySelector: (selector: string) => {
      if (!selector.includes(`:${mock.selectedId}`))
        return null
      const focus = selector.includes('http-request:')
        ? mock.httpFocus
        : selector.includes('snippet:')
          ? mock.snippetFocus
          : mock.noteFocus
      const input = {
        focus: () => {
          focus()
          dom.activeElement = input
        },
        select: vi.fn(),
      }
      return input
    },
  }
  vi.stubGlobal('document', dom)
  mock.folder.mockResolvedValue(42)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it.each(['note', 'snippet', 'http-request'] as const)(
  'saves the replacement before ordinary %s navigation, coalescing double clicks',
  async (type) => {
    let resolve!: (id: number) => void
    const run = vi.fn(
      () =>
        new Promise<number>((done) => {
          resolve = done
        }),
    )
    mock.factory.mockReturnValue({ state: { id: 9, uncertain: false }, run })
    const captured = source()
    mock.open.mockImplementation(async () => {
      expect(captured.insert).toHaveBeenCalledExactlyOnceWith(`[[${type}:9]]`)
      expect(mock.flush).toHaveBeenCalledTimes(3)
    })
    const first = activatePlannedLink(captured, type, 'Planned')
    const second = activatePlannedLink(captured, type, 'Planned')
    expect(first).toBe(second)
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce())
    resolve(9)
    await first
    expect(mock.open).toHaveBeenCalledExactlyOnceWith({ id: 9, type })
    const focus
      = type === 'note'
        ? mock.noteFocus
        : type === 'snippet'
          ? mock.snippetFocus
          : mock.httpFocus
    expect(focus).toHaveBeenCalledOnce()
    expect(focus.mock.invocationCallOrder[0]).toBeGreaterThan(
      mock.open.mock.invocationCallOrder[0]!,
    )
    expect(captured.release).toHaveBeenCalledOnce()
    expect(mock.factory).toHaveBeenCalledWith(
      type === 'http-request'
        ? { name: 'Planned', folderId: 42 }
        : { name: 'Planned' },
      expect.any(Function),
    )
  },
)
it('retries a failed link save without creating again or inserting twice', async () => {
  const run = vi.fn(async () => 9)
  mock.factory.mockReturnValue({ state: { id: 9, uncertain: false }, run })
  mock.flush
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(2)
    .mockRejectedValueOnce(new Error('SAVE_FAILED'))
  const captured = source()
  await activatePlannedLink(captured, 'note', 'Planned')
  expect(mock.open).not.toHaveBeenCalled()
  await activatePlannedLink(captured, 'note', 'Planned')
  expect(mock.factory).toHaveBeenCalledOnce()
  expect(captured.insert).toHaveBeenCalledOnce()
  expect(mock.open).toHaveBeenCalledOnce()
})
it('does not navigate or replace after the source changes during creation', async () => {
  const captured = source()
  mock.factory.mockReturnValue({
    state: { id: 9, uncertain: false },
    run: async () => {
      captured.valid.mockReturnValue(false)
      return 9
    },
  })
  await activatePlannedLink(captured, 'note', 'Planned')
  expect(captured.insert).not.toHaveBeenCalled()
  expect(mock.open).not.toHaveBeenCalled()
  expect(mock.notify).toHaveBeenCalledOnce()
})

it('does not focus another item when navigation did not select the created target', async () => {
  vi.useFakeTimers()
  mock.selectedId = 10
  mock.factory.mockReturnValue({
    state: { id: 9, uncertain: false },
    run: async () => 9,
  })
  const activation = activatePlannedLink(source(), 'note', 'Planned')
  await vi.advanceTimersByTimeAsync(5000)
  await activation
  expect(mock.noteFocus).not.toHaveBeenCalled()
  expect(mock.snippetFocus).not.toHaveBeenCalled()
  expect(mock.httpFocus).not.toHaveBeenCalled()
})

it('waits for the created item title to mount after navigation resolves', async () => {
  mock.selectedId = 10
  mock.factory.mockReturnValue({
    state: { id: 9, uncertain: false },
    run: async () => 9,
  })
  const activation = activatePlannedLink(source(), 'note', 'Planned')
  await vi.waitFor(() => expect(mock.open).toHaveBeenCalledOnce())
  expect(mock.noteFocus).not.toHaveBeenCalled()
  mock.selectedId = 9
  mock.domChanged()
  await activation
  expect(mock.noteFocus).toHaveBeenCalledOnce()
})
