import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

globalThis.ref = ref
globalThis.computed = computed

describe('useNavigationHistory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('../useNavigationUIState')
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
