import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

Object.assign(globalThis, { ref, computed })

describe('useNavigationHistory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('../useNavigationUIState')
    vi.doMock('../spaces/http/useHttpApp', () => ({
      useHttpApp: () => ({ httpState: {} }),
    }))
    vi.doMock('../spaces/http/useHttpFolders', () => ({
      useHttpFolders: () => ({
        folders: ref([]),
        getFolderByIdFromTree: vi.fn(),
      }),
    }))
    vi.doMock('../spaces/http/useHttpRequests', () => ({
      useHttpRequests: () => ({
        currentRequest: ref(),
      }),
    }))
    vi.doMock('../spaces/drawings/useDrawings', () => ({
      useDrawings: () => ({
        activeDrawing: ref(),
      }),
    }))
  })

  it('records the open HTTP folder instead of the previously selected request', async () => {
    const route = ref({ name: 'http-space' })
    const httpState = { activePanel: 'folder', folderId: 4 }
    vi.doMock('@/router', () => ({
      RouterName: { httpSpace: 'http-space', notesSpace: 'notes-space' },
      router: { currentRoute: route },
    }))
    vi.doMock('../spaces/http/useHttpApp', () => ({
      useHttpApp: () => ({ httpState }),
    }))
    vi.doMock('../spaces/http/useHttpFolders', () => ({
      useHttpFolders: () => ({
        folders: ref([]),
        getFolderByIdFromTree: () => ({ id: 4, name: 'Catalog' }),
      }),
    }))
    vi.doMock('../spaces/http/useHttpRequests', () => ({
      useHttpRequests: () => ({
        currentRequest: ref({ id: 8, name: 'Previous request' }),
      }),
    }))
    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({ selectedNote: ref({ id: 2, name: 'Note' }) }),
    }))
    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({ selectedSnippet: ref() }),
    }))
    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()
    await history.recordNavigation(async () => {
      route.value.name = 'notes-space'
    })
    expect(history.canGoBack.value).toBe(true)
    expect(history.goBack()).toEqual({
      type: 'http-folder',
      id: 4,
      name: 'Catalog',
    })
    expect(history.goForward()).toEqual({ type: 'note', id: 2, name: 'Note' })
  })

  it('records internal target navigation and restores backward and forward', async () => {
    const route = ref({ name: 'notes-space' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      route.value = { name: 'main' }
      selectedSnippet.value = { id: 42, name: 'Snippet B' }
    })

    expect(history.entries.value).toEqual([
      { id: 1, name: 'Note A', type: 'note' },
      { id: 42, name: 'Snippet B', type: 'snippet' },
    ])
    expect(history.cursor.value).toBe(1)
    expect(history.canGoBack.value).toBe(true)
    expect(history.canGoForward.value).toBe(false)

    const backTarget = history.goBack()

    expect(backTarget).toEqual({ id: 1, name: 'Note A', type: 'note' })
    expect(history.cursor.value).toBe(0)
    expect(history.canGoForward.value).toBe(true)

    const forwardTarget = history.goForward()

    expect(forwardTarget).toEqual({
      id: 42,
      name: 'Snippet B',
      type: 'snippet',
    })
    expect(history.cursor.value).toBe(1)
  })

  it('stores captured ui state alongside the navigation target', async () => {
    const route = ref({ name: 'notes-space' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesDashboard: 'notes-space/dashboard',
        notesGraph: 'notes-space/graph',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../useNavigationUIState', () => ({
      clearPendingNavigationUIStateRestore: vi.fn(),
      captureNavigationUIState: vi.fn((entry) => {
        if (entry.type === 'note' && entry.id === 1) {
          return { scrollTop: 280 }
        }

        return undefined
      }),
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      route.value = { name: 'notes-space/dashboard' }
    })

    expect(history.entries.value).toEqual([
      {
        id: 1,
        name: 'Note A',
        type: 'note',
        uiState: { scrollTop: 280 },
      },
      {
        routeName: 'notes-space/dashboard',
        type: 'route',
      },
    ])
  })

  it('records graph route before opening a note from graph', async () => {
    const route = ref({ name: 'notes-space/graph' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesGraph: 'notes-space/graph',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      route.value = { name: 'notes-space' }
      selectedNote.value = { id: 2, name: 'Note B' }
    })

    expect(history.entries.value).toEqual([
      {
        routeName: 'notes-space/graph',
        type: 'route',
      },
      { id: 2, name: 'Note B', type: 'note' },
    ])
    expect(history.cursor.value).toBe(1)
  })

  it('records dashboard route before opening a note from dashboard', async () => {
    const route = ref({ name: 'notes-space/dashboard' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesDashboard: 'notes-space/dashboard',
        notesGraph: 'notes-space/graph',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      route.value = { name: 'notes-space' }
      selectedNote.value = { id: 2, name: 'Note B' }
    })

    expect(history.entries.value).toEqual([
      {
        routeName: 'notes-space/dashboard',
        type: 'route',
      },
      { id: 2, name: 'Note B', type: 'note' },
    ])
    expect(history.cursor.value).toBe(1)
  })

  it('records HTTP request targets', async () => {
    const route = ref({ name: 'http-space' })
    const selectedNote = ref<{ id: number, name: string }>()
    const selectedSnippet = ref<{ id: number, name: string }>()
    const currentRequest = ref({ id: 8, name: 'Create snippet' })

    vi.doMock('@/router', () => ({
      RouterName: {
        httpSpace: 'http-space',
        main: 'main',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/http/useHttpRequests', () => ({
      useHttpRequests: () => ({
        currentRequest,
      }),
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      currentRequest.value = { id: 9, name: 'Delete snippet' }
    })

    expect(history.entries.value).toEqual([
      { id: 8, name: 'Create snippet', type: 'http-request' },
      { id: 9, name: 'Delete snippet', type: 'http-request' },
    ])
  })

  it('updates route ui state when recording again from the same dashboard entry', async () => {
    const route = ref({ name: 'notes-space/dashboard' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()
    let dashboardScrollTop = 120

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesDashboard: 'notes-space/dashboard',
        notesGraph: 'notes-space/graph',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../useNavigationUIState', async () => {
      const actual = await vi.importActual('../useNavigationUIState')

      return {
        ...actual,
        captureNavigationUIState: vi.fn((entry) => {
          if (
            entry.type === 'route'
            && entry.routeName === 'notes-space/dashboard'
          ) {
            return { scrollTop: dashboardScrollTop }
          }

          return undefined
        }),
      }
    })

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      route.value = { name: 'notes-space' }
      selectedNote.value = { id: 2, name: 'Note B' }
    })

    expect(history.goBack()).toEqual({
      routeName: 'notes-space/dashboard',
      type: 'route',
      uiState: { scrollTop: 120 },
    })

    route.value = { name: 'notes-space/dashboard' }
    selectedNote.value = { id: 1, name: 'Note A' }
    dashboardScrollTop = 420

    await history.recordNavigation(async () => {
      route.value = { name: 'notes-space' }
      selectedNote.value = { id: 3, name: 'Note C' }
    })

    expect(history.entries.value).toEqual([
      {
        routeName: 'notes-space/dashboard',
        type: 'route',
        uiState: { scrollTop: 420 },
      },
      { id: 3, name: 'Note C', type: 'note' },
    ])
    expect(history.goBack()).toEqual({
      routeName: 'notes-space/dashboard',
      type: 'route',
      uiState: { scrollTop: 420 },
    })
  })

  it('updates current note ui state before moving backward and forward', async () => {
    const route = ref({ name: 'notes-space' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()
    const noteScrollTopById: Record<number, number> = {
      1: 120,
      2: 0,
    }

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesDashboard: 'notes-space/dashboard',
        notesGraph: 'notes-space/graph',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../useNavigationUIState', async () => {
      const actual = await vi.importActual('../useNavigationUIState')

      return {
        ...actual,
        captureNavigationUIState: vi.fn((entry) => {
          if (entry.type === 'note') {
            return { scrollTop: noteScrollTopById[entry.id] ?? 0 }
          }

          return undefined
        }),
      }
    })

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      selectedNote.value = { id: 2, name: 'Note B' }
    })

    noteScrollTopById[2] = 360

    expect(history.goBack()).toEqual({
      id: 1,
      name: 'Note A',
      type: 'note',
      uiState: { scrollTop: 120 },
    })

    selectedNote.value = { id: 1, name: 'Note A' }

    expect(history.goForward()).toEqual({
      id: 2,
      name: 'Note B',
      type: 'note',
      uiState: { scrollTop: 360 },
    })
  })

  it('truncates forward history when recording from the middle', async () => {
    const route = ref({ name: 'notes-space' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      route.value = { name: 'main' }
      selectedSnippet.value = { id: 42, name: 'Snippet B' }
    })

    history.goBack()
    route.value = { name: 'notes-space' }
    selectedNote.value = { id: 1, name: 'Note A' }

    await history.recordNavigation(async () => {
      selectedNote.value = { id: 2, name: 'Note C' }
    })

    expect(history.entries.value).toEqual([
      { id: 1, name: 'Note A', type: 'note' },
      { id: 2, name: 'Note C', type: 'note' },
    ])
    expect(history.cursor.value).toBe(1)
    expect(history.canGoForward.value).toBe(false)
  })

  it('does not duplicate identical current and destination targets', async () => {
    const route = ref({ name: 'notes-space' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      selectedNote.value = { id: 1, name: 'Note A' }
    })

    expect(history.entries.value).toEqual([
      { id: 1, name: 'Note A', type: 'note' },
    ])
    expect(history.cursor.value).toBe(0)
    expect(history.canGoBack.value).toBe(false)
  })

  it('enforces max history size', async () => {
    const route = ref({ name: 'notes-space' })
    const selectedNote = ref({ id: 1, name: 'Note 1' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { MAX_HISTORY_SIZE, useNavigationHistory } = await import(
      '../useNavigationHistory'
    )
    const history = useNavigationHistory()

    for (let index = 2; index <= MAX_HISTORY_SIZE + 5; index += 1) {
      await history.recordNavigation(async () => {
        selectedNote.value = { id: index, name: `Note ${index}` }
      })
    }

    expect(history.entries.value).toHaveLength(MAX_HISTORY_SIZE)
    expect(history.entries.value[0]).toEqual({
      id: 6,
      name: 'Note 6',
      type: 'note',
    })
    expect(history.entries.value.at(-1)).toEqual({
      id: MAX_HISTORY_SIZE + 5,
      name: `Note ${MAX_HISTORY_SIZE + 5}`,
      type: 'note',
    })
    expect(history.cursor.value).toBe(MAX_HISTORY_SIZE - 1)
  })

  it('clears history state explicitly', async () => {
    const route = ref({ name: 'notes-space' })
    const selectedNote = ref({ id: 1, name: 'Note A' })
    const selectedSnippet = ref<{ id: number, name: string }>()

    vi.doMock('@/router', () => ({
      RouterName: {
        main: 'main',
        notesSpace: 'notes-space',
        notesPresentation: 'notes-space/presentation',
      },
      router: {
        currentRoute: route,
      },
    }))

    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({
        selectedNote,
      }),
    }))

    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({
        selectedSnippet,
      }),
    }))

    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()

    await history.recordNavigation(async () => {
      route.value = { name: 'main' }
      selectedSnippet.value = { id: 42, name: 'Snippet B' }
    })

    history.clearHistory()

    expect(history.entries.value).toEqual([])
    expect(history.cursor.value).toBe(-1)
    expect(history.canGoBack.value).toBe(false)
    expect(history.canGoForward.value).toBe(false)
  })
})

describe('navigation transactions', () => {
  async function setup() {
    vi.resetModules()
    vi.doUnmock('../useNavigationUIState')
    const selectedNote = ref({ id: 1, name: 'A' })
    vi.doMock('@/router', () => ({
      RouterName: { notesSpace: 'notes' },
      router: { currentRoute: ref({ name: 'notes' }) },
    }))
    vi.doMock('../spaces/notes/useNotes', () => ({
      useNotes: () => ({ selectedNote }),
    }))
    vi.doMock('../useSnippets', () => ({
      useSnippets: () => ({ selectedSnippet: ref() }),
    }))
    const { useNavigationHistory } = await import('../useNavigationHistory')
    const history = useNavigationHistory()
    const open = (id: number) => {
      selectedNote.value = { id, name: String(id) }
    }
    return { history, open, selectedNote }
  }

  it('commits synchronous A B C immediately and preserves Forward on a no-op', async () => {
    const { history, open } = await setup()
    history.recordNavigation(() => open(2))
    history.recordNavigation(() => open(3))
    expect(
      history.entries.value.map(entry => 'id' in entry && entry.id),
    ).toEqual([1, 2, 3])
    history.goBack()
    open(2)
    history.recordNavigation(() => open(2))
    expect(history.canGoForward.value).toBe(true)
    expect(history.cursor.value).toBe(1)
  })

  it('ignores cancellation and invalidates an async record after clear', async () => {
    const { history, open } = await setup()
    history.recordNavigation(() => false)
    expect(history.entries.value).toEqual([])
    let finish!: () => void
    const pending = history.recordNavigation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const next = history.recordNavigation(() => open(2))
    finish()
    await pending
    await next
    expect(history.entries.value).toHaveLength(2)
    const pendingClear = history.recordNavigation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    history.clearHistory()
    finish()
    await pendingClear
    expect(history.entries.value).toEqual([])
  })

  it('finishes a deferred entity open before Back and leaves cursor on the visible target', async () => {
    const { history, open, selectedNote } = await setup()
    history.recordNavigation(() => open(2))
    let resolveFetch!: () => void
    const fetched = new Promise<void>((resolve) => {
      resolveFetch = resolve
    })
    const opening = history.recordNavigation(async () => {
      await fetched
      open(3)
    })
    const restore = vi.fn(async (entry: { id?: number }) => {
      open(entry.id!)
      return 'restored' as const
    })
    const back = history.restoreHistory(-1, restore)
    expect(restore).not.toHaveBeenCalled()
    expect(selectedNote.value.id).toBe(2)
    resolveFetch()
    await opening
    await back
    expect(selectedNote.value.id).toBe(2)
    expect(history.entries.value[history.cursor.value]).toMatchObject({
      id: 2,
    })
    expect(
      history.entries.value.map(entry => 'id' in entry && entry.id),
    ).toEqual([1, 2, 3])
  })

  it('serializes two ordinary opens with late mutations and continues after rejection', async () => {
    const { history, open, selectedNote } = await setup()
    let resolveFetch!: () => void
    const fetched = new Promise<void>((resolve) => {
      resolveFetch = resolve
    })
    const first = history.recordNavigation(async () => {
      await fetched
      open(2)
    })
    const secondCallback = vi.fn(async () => {
      open(3)
    })
    const second = history.recordNavigation(secondCallback)
    expect(secondCallback).not.toHaveBeenCalled()
    resolveFetch()
    await Promise.all([first, second])
    expect(selectedNote.value.id).toBe(3)
    expect(history.entries.value[history.cursor.value]).toMatchObject({
      id: 3,
    })
    expect(
      history.entries.value.map(entry => 'id' in entry && entry.id),
    ).toEqual([1, 2, 3])
    const failed = history.recordNavigation(async () => {
      throw new Error('offline')
    })
    const recovery = history.recordNavigation(() => open(4))
    await expect(failed).rejects.toThrow('offline')
    await recovery
    expect(selectedNote.value.id).toBe(4)
    expect(history.entries.value[history.cursor.value]).toMatchObject({
      id: 4,
    })
  })

  it('commits the cursor only on success and blocks concurrent replay and explicit opens', async () => {
    const { history, open } = await setup()
    history.recordNavigation(() => open(2))
    let finish!: (result: 'restored') => void
    const restore = vi.fn(
      () =>
        new Promise<'restored'>((resolve) => {
          finish = resolve
        }),
    )
    const pending = history.restoreHistory(-1, restore)
    expect(history.cursor.value).toBe(1)
    const explicitOpen = vi.fn()
    history.recordNavigation(explicitOpen)
    await history.restoreHistory(-1, restore)
    expect(explicitOpen).not.toHaveBeenCalled()
    expect(restore).toHaveBeenCalledOnce()
    finish('restored')
    await pending
    expect(history.cursor.value).toBe(0)
  })

  it('prunes missing entries, continues backward and preserves the current entry when all are missing', async () => {
    const { history, open } = await setup()
    history.recordNavigation(() => open(2))
    history.recordNavigation(() => open(3))
    const restore = vi
      .fn()
      .mockResolvedValueOnce('missing')
      .mockResolvedValueOnce('restored')
    await history.restoreHistory(-1, restore)
    expect(
      history.entries.value.map(entry => 'id' in entry && entry.id),
    ).toEqual([1, 3])
    expect(history.cursor.value).toBe(0)
    await history.restoreHistory(1, async () => 'missing')
    expect(history.entries.value).toHaveLength(1)
    expect(history.cursor.value).toBe(0)
  })

  it('keeps history and cursor on cancelled or failed restoration', async () => {
    const { history, open } = await setup()
    history.recordNavigation(() => open(2))
    await history.restoreHistory(-1, async () => 'cancelled')
    await expect(
      history.restoreHistory(-1, async () => {
        throw new Error('offline')
      }),
    ).rejects.toThrow('offline')
    expect(history.cursor.value).toBe(1)
    expect(history.entries.value).toHaveLength(2)
    expect(history.isNavigatingHistory.value).toBe(false)
  })
})
