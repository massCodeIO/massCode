import { beforeEach, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'

async function setup(space = 'notes', page = 'notes-space') {
  vi.resetModules()
  Object.assign(globalThis, { computed, nextTick, ref, watch })
  const activeSpace = ref(space)
  const currentRoute = ref({ name: page })
  const aiOpen = ref(false)
  const notesOpen = ref(false)
  const httpOpen = ref(false)
  const mindmap = ref(false)
  const primaryHidden = ref(false)
  const togglePrimary = vi.fn(() => {
    primaryHidden.value = !primaryHidden.value
  })
  vi.doMock('@/composables', () => ({
    useApp: () => ({
      isSidebarHidden: primaryHidden,
      toggleCodeSidebar: togglePrimary,
    }),
    useNotesApp: () => ({
      isNotesSidebarHidden: primaryHidden,
      toggleNotesSidebar: togglePrimary,
      isNotesInspectorOpen: notesOpen,
      isNotesMindmapShown: mindmap,
      isNotesPresentationShown: ref(false),
    }),
    useHttpApp: () => ({
      isHttpSidebarHidden: primaryHidden,
      toggleHttpSidebar: togglePrimary,
    }),
  }))
  vi.doMock('@/composables/ai/useAi', () => ({
    useAi: () => ({
      open: aiOpen,
      openAndFocus: vi.fn(async () => {
        aiOpen.value = true
      }),
      setOpen: (value: boolean) => {
        aiOpen.value = value
      },
    }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpPanels', () => ({
    useHttpPanels: () => ({ inspectorOpen: httpOpen }),
  }))
  vi.doMock('@/electron', () => ({
    store: { app: { get: vi.fn(), set: vi.fn() } },
  }))
  vi.doMock('@/spaceDefinitions', () => ({
    getActiveSpaceId: () => activeSpace.value,
  }))
  vi.doMock('@/router', () => ({
    router: { currentRoute },
    RouterName: {
      notesSpace: 'notes-space',
      notesPresentation: 'notes-space/presentation',
    },
  }))
  const { useSpacePanels } = await import('../useSpacePanels')
  return {
    panels: useSpacePanels(),
    aiOpen,
    notesOpen,
    httpOpen,
    mindmap,
    primaryHidden,
    activeSpace,
    currentRoute,
  }
}

beforeEach(() => vi.clearAllMocks())

it.each(['code', 'notes', 'http'])(
  'closes the visible AI sidebar in %s including its underlying inspector',
  async (space) => {
    const state = await setup(space)
    state.aiOpen.value = true
    state.notesOpen.value = space === 'notes'
    state.httpOpen.value = space === 'http'
    expect(state.panels.secondaryOpen.value).toBe(true)
    state.panels.toggleSecondary()
    expect(state.panels.secondaryOpen.value).toBe(false)
    expect(state.aiOpen.value).toBe(false)
    expect(state.notesOpen.value).toBe(false)
    expect(state.httpOpen.value).toBe(false)
    state.panels.toggleSecondary()
    expect(state.panels.secondaryOpen.value).toBe(true)
  },
)

it('opens AI on the Notes dashboard instead of the unmounted inspector', async () => {
  const state = await setup('notes', 'notes-space/dashboard')
  state.notesOpen.value = true
  expect(state.panels.secondaryOpen.value).toBe(false)
  state.panels.toggleSecondary()
  expect(state.aiOpen.value).toBe(true)
})

it('uses AI for the secondary sidebar in mindmap mode', async () => {
  const state = await setup()
  state.mindmap.value = true
  state.notesOpen.value = true
  expect(state.panels.secondaryOpen.value).toBe(false)
  state.panels.toggleSecondary()
  expect(state.aiOpen.value).toBe(true)
})

it.each(['code', 'notes', 'http', 'math', 'drawings', 'tools'])(
  'toggles the primary sidebar in %s',
  async (space) => {
    const { panels } = await setup(space)
    expect(panels.primaryOpen.value).toBe(true)
    panels.togglePrimary()
    expect(panels.primaryOpen.value).toBe(false)
    panels.togglePrimary()
    expect(panels.primaryOpen.value).toBe(true)
    expect(panels.secondaryAvailable.value).toBe(
      ['code', 'notes', 'http'].includes(space),
    )
  },
)

it('does not expose a primary sidebar in standalone presentation mode', async () => {
  const { panels, primaryHidden } = await setup(
    'notes',
    'notes-space/presentation',
  )
  expect(panels.primaryAvailable.value).toBe(false)
  panels.togglePrimary()
  expect(primaryHidden.value).toBe(false)
})

it.each(['code', 'notes', 'http'])(
  'opens, focuses, and closes AI contextually in %s',
  async (space) => {
    const state = await setup(space)
    const editor = { closest: () => null, isConnected: true, focus: vi.fn() }
    const chatInput = {
      closest: () => ({}),
      isConnected: true,
      focus: vi.fn(),
    }
    const doc = { activeElement: editor, body: {}, querySelectorAll: () => [] }
    vi.stubGlobal('document', doc)
    try {
      await state.panels.toggleAi()
      expect(state.aiOpen.value).toBe(true)
      // AI is open, but focus remains outside: the shortcut must keep it open.
      await state.panels.toggleAi()
      expect(state.aiOpen.value).toBe(true)
      state.notesOpen.value = space === 'notes'
      state.httpOpen.value = space === 'http'
      doc.activeElement = chatInput
      await state.panels.toggleAi()
      expect(state.panels.secondaryOpen.value).toBe(false)
      expect(state.notesOpen.value).toBe(false)
      expect(state.httpOpen.value).toBe(false)
      expect(editor.focus).toHaveBeenCalledOnce()
    }
    finally {
      vi.unstubAllGlobals()
    }
  },
)
