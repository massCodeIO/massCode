import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

globalThis.ref = ref
globalThis.computed = computed

describe('useNavigationHistory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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
