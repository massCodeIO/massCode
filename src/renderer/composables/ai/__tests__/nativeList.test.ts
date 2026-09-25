import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => {
  const codeState: {
    snippetId?: number
    folderId?: number
    tagId?: number
    libraryFilter?: string
  } = { snippetId: 1 }
  const notesState: {
    noteId?: number
    folderId?: number
    tagId?: number
    libraryFilter?: string
  } = { noteId: 1 }
  const httpState: {
    requestId?: number
    folderId?: number
    libraryFilter?: string
  } = { requestId: 1 }
  const items = { value: [{ id: 1 }, { id: 2 }] }
  const codeIds = { value: [1] }
  const noteIds = { value: [1] }
  const httpIds = { value: [1] }
  const search = {
    searchQuery: { value: '' },
    clearSearch: vi.fn(),
    search: vi.fn(),
    displayedNotes: items,
    displayedRequests: items,
  }
  return {
    codeState,
    notesState,
    httpState,
    items,
    codeIds,
    noteIds,
    httpIds,
    codeAnchor: { value: 1 as number | undefined },
    noteAnchor: { value: 1 as number | undefined },
    search,
    load: vi.fn(),
    selectFirst: vi.fn(),
    selectHttp: vi.fn(),
    currentRequest: { value: { id: 1 } },
    route: { value: { name: 'code' } },
    push: vi.fn(),
    confirm: vi.fn(),
    tags: { value: [{ id: 9 }] },
  }
})
vi.mock('@/composables/useApp', () => ({
  useApp: () => ({ state: mock.codeState }),
}))
vi.mock('@/composables/spaces/notes/useNotesApp', () => ({
  useNotesApp: () => ({ notesState: mock.notesState }),
}))
vi.mock('@/composables/spaces/http/useHttpApp', () => ({
  useHttpApp: () => ({ httpState: mock.httpState }),
}))
vi.mock('@/composables/useSnippets', () => ({
  useSnippets: () => ({
    ...mock.search,
    displayedSnippets: mock.items,
    selectedSnippetIds: mock.codeIds,
    lastSelectedSnippetId: mock.codeAnchor,
    selectSnippet: (id: number) => {
      mock.codeState.snippetId = id
    },
    getSnippets: mock.load,
    selectFirstSnippet: mock.selectFirst,
  }),
}))
vi.mock('@/composables/spaces/notes/useNotes', () => ({
  useNotes: () => ({
    selectedNoteIds: mock.noteIds,
    lastSelectedNoteId: mock.noteAnchor,
    selectNote: (id: number) => {
      mock.notesState.noteId = id
    },
    getNotes: mock.load,
    selectFirstNote: mock.selectFirst,
  }),
}))
vi.mock('@/composables/spaces/http/useHttpRequests', () => ({
  useHttpRequests: () => ({
    selectedRequestIds: mock.httpIds,
    lastSelectedRequestId: { value: 1 },
    selectHttpRequest: mock.selectHttp,
    currentRequest: mock.currentRequest,
    getHttpRequests: mock.load,
    selectFirstRequest: mock.selectFirst,
  }),
}))
vi.mock('@/composables/spaces/notes/useNoteSearch', () => ({
  useNoteSearch: () => mock.search,
}))
vi.mock('@/composables/spaces/http/useHttpSearch', () => ({
  useHttpSearch: () => mock.search,
}))
vi.mock('@/composables/useFolders', () => ({
  useFolders: () => ({ clearFolderSelection: vi.fn() }),
}))
vi.mock('@/composables/spaces/notes/useNoteFolders', () => ({
  useNoteFolders: () => ({ clearFolderSelection: vi.fn() }),
}))
vi.mock('@/composables/spaces/http/useHttpFolders', () => ({
  useHttpFolders: vi.fn(),
}))
vi.mock('@/composables/spaces/notes/useNotesWorkspaceNavigation', () => ({
  useNotesWorkspaceNavigation: () => ({
    openTagInNotesWorkspace: async (id: number) => {
      mock.notesState.tagId = id
      return true
    },
  }),
}))
vi.mock('@/composables/spaces/http/useHttpWorkspaceNavigation', () => ({
  useHttpWorkspaceNavigation: vi.fn(),
}))
vi.mock('@/composables/useTags', () => ({
  useTags: () => ({ tags: mock.tags }),
}))
vi.mock('@/composables/spaces/notes/useNoteTags', () => ({
  useNoteTags: () => ({ tags: mock.tags }),
}))
vi.mock('@/composables/spaces/http/runtimeNavigation', () => ({
  httpRuntimeNavigation: { confirmLeave: mock.confirm, transitionToken: 0 },
}))
vi.mock('@/router', () => ({
  router: { push: mock.push, currentRoute: mock.route },
  RouterName: { main: 'code', notesSpace: 'notes', httpSpace: 'http' },
}))
const { executeNativeList } = await import('../nativeList')
beforeEach(() => {
  vi.clearAllMocks()
  mock.push.mockImplementation(async ({ name }: { name: string }) => {
    mock.route.value.name = name
  })
  mock.codeIds.value = [1]
  mock.noteIds.value = [1]
  mock.httpIds.value = [1]
  mock.items.value = [{ id: 1 }, { id: 2 }]
  mock.search.searchQuery.value = ''
  mock.codeState.snippetId = 1
  mock.notesState.noteId = 1
  delete mock.codeState.tagId
  delete mock.notesState.tagId
  mock.load.mockResolvedValue(true)
  mock.confirm.mockResolvedValue(true)
  mock.search.search.mockResolvedValue(true)
  mock.selectHttp.mockImplementation(async (id: number) => {
    mock.httpState.requestId = id
    mock.currentRequest.value = { id }
    return true
  })
})
it.each(['code', 'notes', 'http'] as const)(
  'selects exact IDs with a coherent primary in %s',
  async (space) => {
    const result = await executeNativeList(
      { action: 'listSelection', space, ids: [2, 1] },
      () => true,
    )
    expect(result).toMatchObject({
      status: 'done',
      list: { selectedIds: [2, 1], count: 2 },
    })
    expect(
      space === 'code'
        ? mock.codeState.snippetId
        : space === 'notes'
          ? mock.notesState.noteId
          : mock.httpState.requestId,
    ).toBe(2)
  },
)
it.each(['code', 'notes', 'http'] as const)(
  'refuses IDs absent from displayed %s list before mutation',
  async (space) => {
    expect(
      await executeNativeList(
        { action: 'listSelection', space, ids: [3] },
        () => true,
      ),
    ).toEqual({ status: 'unavailable' })
    expect(mock.selectHttp).not.toHaveBeenCalled()
  },
)
it('honors Cancel for an already selected HTTP request without changing multi-selection', async () => {
  mock.httpState.requestId = 1
  mock.selectHttp.mockResolvedValueOnce(false)
  expect(
    await executeNativeList(
      { action: 'listSelection', space: 'http', ids: [1, 2] },
      () => true,
    ),
  ).toEqual({ status: 'cancelled' })
  expect(mock.httpIds.value).toEqual([1])
})
it('revalidates displayed membership after the HTTP dirty prompt', async () => {
  mock.selectHttp.mockImplementationOnce(async () => {
    mock.items.value = [{ id: 1 }]
    return true
  })
  expect(
    await executeNativeList(
      { action: 'listSelection', space: 'http', ids: [2] },
      () => true,
    ),
  ).toEqual({ status: 'stale' })
})
it.each(['code', 'notes'] as const)(
  'applies a known tag even when %s state had no tagId property',
  async (space) => {
    expect(
      await executeNativeList(
        { action: 'listQuery', space, scope: { kind: 'tag', id: 9 } },
        () => true,
      ),
    ).toMatchObject({
      status: 'done',
      list: { scope: { kind: 'tag', id: 9 } },
    })
  },
)
it('does not mutate the query when HTTP navigation is cancelled', async () => {
  mock.confirm.mockResolvedValueOnce(false)
  expect(
    await executeNativeList(
      { action: 'listQuery', space: 'http', query: 'new' },
      () => true,
    ),
  ).toEqual({ status: 'cancelled' })
  expect(mock.search.searchQuery.value).toBe('')
  expect(mock.load).not.toHaveBeenCalled()
})
it.each(['code', 'notes', 'http'] as const)(
  'clears the explicit selection in %s',
  async (space) => {
    expect(
      await executeNativeList(
        { action: 'listSelection', space, ids: [] },
        () => true,
      ),
    ).toMatchObject({ status: 'done', list: { selectedIds: [] } })
    expect(
      space === 'code'
        ? mock.codeState.snippetId
        : space === 'notes'
          ? mock.notesState.noteId
          : mock.httpState.requestId,
    ).toBeUndefined()
  },
)
it('returns an honest empty search result and refuses failed loading', async () => {
  mock.items.value = []
  expect(
    await executeNativeList(
      { action: 'listQuery', space: 'code', query: 'absent' },
      () => true,
    ),
  ).toMatchObject({ status: 'done', list: { query: 'absent', count: 0 } })
  mock.search.search.mockResolvedValueOnce(false)
  expect(
    await executeNativeList(
      { action: 'listQuery', space: 'code', query: 'failed' },
      () => true,
    ),
  ).toEqual({ status: 'failed' })
})

it.each(['code', 'notes'] as const)(
  'does not open the first %s item when cancelled during loading',
  async (space) => {
    let current = true
    mock.load.mockImplementationOnce(async () => {
      current = false
      return true
    })
    expect(
      await executeNativeList(
        { action: 'listQuery', space, query: '' },
        () => current,
      ),
    ).toEqual({ status: 'stale' })
    expect(mock.selectFirst).not.toHaveBeenCalled()
  },
)

it.each(['code', 'notes'] as const)(
  'restores coherent %s selection when clearing native search',
  async (space) => {
    const ids = space === 'code' ? mock.codeIds : mock.noteIds
    const anchor = space === 'code' ? mock.codeAnchor : mock.noteAnchor
    ids.value = [2]
    anchor.value = 2
    mock.search.clearSearch.mockImplementationOnce(() => {
      if (space === 'code')
        mock.codeState.snippetId = 1
      else mock.notesState.noteId = 1
    })
    expect(
      await executeNativeList(
        { action: 'listQuery', space, scope: { kind: 'clear' } },
        () => true,
      ),
    ).toMatchObject({ status: 'done', list: { selectedIds: [1] } })
    expect(anchor.value).toBe(1)
    expect(mock.selectFirst).not.toHaveBeenCalled()
    mock.items.value = []
    expect(
      await executeNativeList(
        { action: 'listQuery', space, scope: { kind: 'clear' } },
        () => true,
      ),
    ).toMatchObject({ status: 'done', list: { selectedIds: [] } })
    expect(anchor.value).toBeUndefined()
    expect(
      space === 'code' ? mock.codeState.snippetId : mock.notesState.noteId,
    ).toBeUndefined()
  },
)
