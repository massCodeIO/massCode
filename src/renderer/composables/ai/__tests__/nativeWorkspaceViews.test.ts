import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  notes: {
    isNotesMindmapShown: { value: false },
    isNotesPresentationShown: { value: false },
    notesInspectorTab: { value: 'outline' },
    isNotesInspectorOpen: { value: false },
  },
  route: { value: { name: 'http' } },
  dashboard: {
    dashboardError: { value: null },
    dashboardData: {
      value: {
        stats: { notesCount: 4, wordsCount: 99, foldersCount: 2, tagsCount: 3 },
        activity: {
          days: { '2026-09-23': 5 },
          notesUpdatedToday: 5,
          notesUpdatedLast7Days: 5,
        },
        recent: [{ id: 1, name: 'Recent', folder: null, updatedAt: 100 }],
        topLinked: [{ id: 2, name: 'Linked', incomingLinksCount: 9 }],
      },
    },
    getNotesDashboard: vi.fn(),
  },
  graph: {
    graphData: { value: { nodes: [] } },
    graphError: { value: null },
    getNotesGraph: vi.fn(),
  },
  aiOpen: vi.fn(),
  fetchHttp: vi.fn(),
  stored: vi.fn(),
  sort: { sort: 'name', order: 'ASC' },
}))
vi.mock('@/composables/spaces/notes/useNotesWorkspaceNavigation', () => ({
  useNotesWorkspaceNavigation: () => ({}),
}))
vi.mock('@/composables/spaces/notes/useNotesApp', () => ({
  useNotesApp: () => mock.notes,
}))
vi.mock('@/composables/spaces/notes/useNotes', () => ({
  useNotes: () => ({}),
}))
vi.mock('@/composables/spaces/notes/useNotesDashboard', () => ({
  useNotesDashboard: () => mock.dashboard,
}))
vi.mock('@/composables/spaces/notes/useNotesGraph', () => ({
  useNotesGraph: () => mock.graph,
}))
vi.mock('@/composables/spaces/http/useHttpApp', () => ({
  useHttpApp: () => ({}),
}))
vi.mock('@/composables/spaces/http/useHttpRequests', () => ({
  useHttpRequests: () => ({ getHttpRequests: mock.fetchHttp }),
}))
vi.mock('@/composables/useApp', () => ({ useApp: () => ({}) }))
vi.mock('@/composables/useSnippets', () => ({ useSnippets: () => ({}) }))
vi.mock('@/composables/useContentSort', () => ({
  useContentSort: () => ({
    setContentSortField: vi.fn(),
    setContentSortOrder: vi.fn(),
    getContentSortQuery: () => mock.sort,
  }),
}))
vi.mock('@/electron', () => ({ store: { app: { get: mock.stored } } }))
vi.mock('@/router', () => ({
  router: {
    currentRoute: mock.route,
    push: async ({ name }: { name: string }) => {
      mock.route.value.name = name
    },
  },
  RouterName: { notesDashboard: 'dashboard', notesGraph: 'graph' },
}))
vi.mock('../useAi', () => ({ useAi: () => ({ setOpen: mock.aiOpen }) }))
vi.mock('../nativeActions', () => ({
  matchesNativeTarget: () => true,
  readNativeState: () => ({
    space: 'http',
    selectedIds: [],
    canGoBack: false,
    canGoForward: false,
  }),
}))
const { executeWorkspaceView } = await import('../nativeWorkspaceViews')
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('nextTick', async () => {})
  mock.notes.isNotesMindmapShown.value = false
  mock.notes.isNotesPresentationShown.value = false
  mock.stored.mockReturnValue(mock.sort)
})
it('does not report a sorted HTTP list as ready when native loading failed', async () => {
  mock.fetchHttp.mockResolvedValue(false)
  expect(
    await executeWorkspaceView(
      { action: 'listView', space: 'http', sort: 'name' },
      () => true,
    ),
  ).toEqual({ status: 'failed' })
  mock.fetchHttp.mockResolvedValue(true)
  expect(
    await executeWorkspaceView(
      { action: 'listView', space: 'http', sort: 'name' },
      () => true,
    ),
  ).toMatchObject({ status: 'done', persisted: true })
})
it('exits the AI tab before toggling the Notes inspector and refuses hidden inspector modes', async () => {
  const action = {
    action: 'notesInspector' as const,
    target: { space: 'notes' as const, id: 1 },
    tab: 'links' as const,
    visible: true,
  }
  expect(await executeWorkspaceView(action, () => true)).toMatchObject({
    status: 'done',
  })
  expect(mock.aiOpen).toHaveBeenCalledWith(false)
  expect(mock.notes.notesInspectorTab.value).toBe('links')
  expect(mock.notes.isNotesInspectorOpen.value).toBe(true)
  mock.notes.isNotesMindmapShown.value = true
  expect(await executeWorkspaceView(action, () => true)).toEqual({
    status: 'unavailable',
  })
  expect(mock.aiOpen).toHaveBeenCalledOnce()
})

it('returns actual dashboard data and the heatmap range used by the native cells', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 23, 12))
  try {
    const result = await executeWorkspaceView(
      { action: 'notesPage', page: 'dashboard' },
      () => true,
    )
    expect(result).toMatchObject({
      status: 'done',
      dashboard: {
        ...mock.dashboard.dashboardData.value,
        heatmap: { count: 371, to: '2026-09-23', totalUpdates: 5 },
      },
    })
    expect(result.dashboard?.heatmap.from).not.toBe('2026-01-01')
    expect(mock.dashboard.getNotesDashboard).toHaveBeenCalledOnce()
  }
  finally {
    vi.useRealTimers()
  }
})
it('rejects a note creation kind on HTTP lists', async () => {
  expect(
    await executeWorkspaceView(
      { action: 'listView', space: 'http', createKind: 'task' },
      () => true,
    ),
  ).toEqual({ status: 'unavailable' })
})

it('reads dashboard facts without navigating or writing settings and rejects a stale completion', async () => {
  mock.route.value.name = 'http'
  const result = await executeWorkspaceView(
    { action: 'readNotesDashboard' },
    () => true,
  )
  expect(result).toMatchObject({
    status: 'done',
    dashboard: { stats: { notesCount: 4 } },
  })
  expect(mock.route.value.name).toBe('http')
  expect(mock.dashboard.getNotesDashboard).toHaveBeenCalledOnce()
  expect(mock.stored).not.toHaveBeenCalled()
  let current = true
  mock.dashboard.getNotesDashboard.mockImplementationOnce(async () => {
    current = false
  })
  expect(
    await executeWorkspaceView({ action: 'readNotesDashboard' }, () => current),
  ).toEqual({ status: 'stale' })
  expect(mock.route.value.name).toBe('http')
})

it('waits for graph loading and its render tick before reporting the page ready', async () => {
  let resolve!: () => void
  mock.graph.getNotesGraph.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done
      }),
  )
  const ticks = vi.fn(async () => {})
  vi.stubGlobal('nextTick', ticks)
  let finished = false
  const pending = executeWorkspaceView(
    { action: 'notesPage', page: 'graph' },
    () => true,
  ).then((result) => {
    finished = true
    return result
  })
  await vi.waitFor(() =>
    expect(mock.graph.getNotesGraph).toHaveBeenCalledOnce(),
  )
  expect(ticks).toHaveBeenCalledOnce()
  expect(finished).toBe(false)
  resolve()
  expect(await pending).toMatchObject({ status: 'done' })
  expect(ticks).toHaveBeenCalledTimes(2)
})
