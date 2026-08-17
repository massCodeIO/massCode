import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'

globalThis.computed = computed
globalThis.nextTick = nextTick
globalThis.reactive = reactive
globalThis.ref = ref
globalThis.shallowRef = shallowRef
globalThis.watch = watch

interface SetupOptions {
  folderId?: number
  libraryFilter?: string
  snippetId?: number
  tagId?: number
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const state = reactive<{
    folderId?: number
    libraryFilter?: string
    snippetContentIndex?: number
    snippetId?: number
    tagId?: number
  }>({
    folderId: options.folderId,
    libraryFilter: options.libraryFilter,
    snippetContentIndex: 0,
    snippetId: options.snippetId,
    tagId: options.tagId,
  })

  const getSnippets = vi.fn(async () => ({
    data: [{ contents: [], id: 1, name: 'Search result', tags: [] }],
  }))
  const getSnippetsById = vi.fn(async (id: string) => ({
    data: {
      contents: [
        {
          id: Number(id) * 10,
          label: 'Fragment 1',
          language: 'text',
          value: `Content ${id}`,
        },
      ],
      id: Number(id),
      name: 'Selected snippet',
      tags: [],
    },
  }))
  const postSnippetsByIdContents = vi.fn()

  // useContentSort читает store.app при импорте модуля: мокается целиком,
  // чтобы не тянуть electron store в тест.
  vi.doMock('@/composables/useContentSort', () => ({
    useContentSort: () => ({
      getContentSortQuery: () => ({}),
    }),
  }))

  vi.doMock('@/composables/useDonations', () => ({
    useDonations: () => ({
      incrementCopy: vi.fn(),
      incrementCreated: vi.fn(),
    }),
  }))

  vi.doMock('@/composables/useStorageMutation', () => ({
    markPersistedStorageMutation: vi.fn(),
  }))

  vi.doMock('@/electron', () => ({
    i18n: {
      t: (key: string) => key,
    },
  }))

  vi.doMock('@/utils', () => ({
    getContiguousSelection: vi.fn(() => []),
  }))

  vi.doMock('~/renderer/services/api', () => ({
    api: {
      snippets: {
        deleteSnippetsById: vi.fn(),
        deleteSnippetsByIdContentsByContentId: vi.fn(),
        deleteSnippetsByIdTagsByTagId: vi.fn(),
        deleteSnippetsTrash: vi.fn(),
        getSnippets,
        // refreshSelectedSnippet дёргает загрузку полной записи по id:
        // отсутствие метода давало «зелёные» тесты с TypeError в stderr.
        getSnippetsById,
        patchSnippetsById: vi.fn(),
        patchSnippetsByIdContentsByContentId: vi.fn(),
        postSnippets: vi.fn(),
        postSnippetsByIdContents,
        postSnippetsByIdTagsByTagId: vi.fn(),
      },
    },
  }))

  vi.doMock('../index', () => ({
    useApp: () => ({
      focusSnippetNameInput: vi.fn(),
      isFocusedSearch: ref(false),
      restoreStateSnapshot: vi.fn(),
      saveStateSnapshot: vi.fn(),
      state,
    }),
    useDialog: () => ({
      confirm: vi.fn(async () => true),
    }),
    useFolders: () => ({
      folders: ref([]),
      getFolderByIdFromTree: vi.fn(() => null),
    }),
  }))

  vi.doMock('../useSnippetScroller', () => ({
    scrollToSnippetIndex: vi.fn(),
  }))

  const { useSnippets } = await import('../useSnippets')
  const snippets = useSnippets()

  return {
    getSnippets,
    getSnippetsById,
    postSnippetsByIdContents,
    snippets,
    state,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSnippets search', () => {
  it('combines search with the selected tag context', async () => {
    const context = await setup({ tagId: 12 })

    context.snippets.searchQuery.value = 'migration'
    await context.snippets.search()

    expect(context.getSnippets).toHaveBeenCalledWith({
      search: 'migration',
      tagId: 12,
    })
  })

  it('combines search with the selected folder context', async () => {
    const context = await setup({ folderId: 7 })

    context.snippets.searchQuery.value = 'compose'
    await context.snippets.search()

    expect(context.getSnippets).toHaveBeenCalledWith({
      folderId: 7,
      search: 'compose',
    })
  })

  it('combines search with library filters', async () => {
    const context = await setup({ libraryFilter: 'favorites' })

    context.snippets.searchQuery.value = 'token'
    await context.snippets.search()

    expect(context.getSnippets).toHaveBeenCalledWith({
      isFavorites: 1,
      search: 'token',
    })
  })
})

describe('selected snippet full record', () => {
  it('normalizes a stale fragment index when the selected snippet is ready', async () => {
    const context = await setup({ snippetId: 5 })
    context.getSnippetsById.mockResolvedValueOnce({
      data: {
        contents: [
          {
            id: 50,
            label: 'Fragment 1',
            language: 'text',
            value: 'First',
          },
          {
            id: 51,
            label: 'Fragment 2',
            language: 'text',
            value: 'Second',
          },
        ],
        id: 5,
        name: 'Selected snippet',
        tags: [],
      },
    })
    context.state.snippetContentIndex = 1
    await context.snippets.refreshSelectedSnippet()

    expect(context.snippets.displayedSnippetContent.value?.id).toBe(51)

    context.state.snippetId = 1
    await vi.waitFor(() => {
      expect(context.snippets.selectedSnippetRecordStatus.value).toBe('ready')
    })

    expect(context.state.snippetContentIndex).toBe(0)
    expect(context.snippets.displayedSnippetContent.value?.id).toBe(10)
  })

  it('does not select a newly added fragment after switching snippets', async () => {
    const context = await setup({ snippetId: 5 })
    await context.snippets.refreshSelectedSnippet()

    let resolveCreate!: () => void
    context.postSnippetsByIdContents.mockImplementationOnce(
      () => new Promise<void>(resolve => (resolveCreate = resolve)),
    )

    const addRequest = context.snippets.addFragment()
    context.state.snippetId = 1
    await vi.waitFor(() => {
      expect(context.snippets.selectedSnippetRecordStatus.value).toBe('ready')
      expect(context.snippets.selectedSnippet.value?.id).toBe(1)
    })

    resolveCreate()
    await addRequest

    expect(context.state.snippetId).toBe(1)
    expect(context.state.snippetContentIndex).toBe(0)
    expect(context.snippets.displayedSnippetContent.value?.id).toBe(10)
  })

  it('clears both domain and display records when selection is cleared', async () => {
    const context = await setup({ snippetId: 5 })
    await context.snippets.refreshSelectedSnippet()

    context.state.snippetId = undefined
    await nextTick()

    expect(context.snippets.selectedSnippet.value).toBeUndefined()
    expect(context.snippets.displayedSnippet.value).toBeUndefined()
    expect(context.snippets.displayedSnippetContent.value).toBeUndefined()
    expect(context.snippets.selectedSnippetRecordStatus.value).toBe('idle')
  })

  it('keeps the previous display record until the current snippet is ready', async () => {
    const context = await setup({ snippetId: 5 })
    await context.snippets.refreshSelectedSnippet()
    await context.snippets.getSnippets()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    expect(context.snippets.selectedSnippet.value?.id).toBe(5)
    expect(context.snippets.displayedSnippet.value?.id).toBe(5)
    expect(context.snippets.displayedSnippetContent.value?.value).toBe(
      'Content 5',
    )

    let rejectRequest!: (reason: Error) => void
    context.getSnippetsById.mockImplementationOnce(
      () => new Promise((_resolve, reject) => (rejectRequest = reject)),
    )

    context.state.snippetId = 1
    await nextTick()

    expect(context.snippets.selectedSnippetRecordStatus.value).toBe('loading')
    expect(context.snippets.selectedSnippet.value?.id).toBe(1)
    expect(context.snippets.displayedSnippet.value?.id).toBe(5)
    expect(context.snippets.displayedSnippetContent.value?.value).toBe(
      'Content 5',
    )

    rejectRequest(new Error('network'))
    await vi.waitFor(() => {
      expect(context.snippets.selectedSnippetRecordStatus.value).toBe('error')
    })
    expect(context.snippets.selectedSnippet.value?.id).toBe(1)
    expect(context.snippets.displayedSnippet.value?.id).toBe(5)
    expect(context.snippets.displayedSnippetContent.value?.value).toBe(
      'Content 5',
    )

    await context.snippets.retrySelectedSnippet()

    expect(context.snippets.selectedSnippetRecordStatus.value).toBe('ready')
    expect(context.snippets.selectedSnippet.value?.id).toBe(1)
    expect(context.snippets.displayedSnippet.value?.id).toBe(1)
    expect(context.snippets.displayedSnippetContent.value?.value).toBe(
      'Content 1',
    )
    consoleError.mockRestore()
  })

  it('keeps selected snippet aligned while loading and after an error', async () => {
    const context = await setup({ snippetId: 5 })
    await context.snippets.refreshSelectedSnippet()
    await context.snippets.getSnippets()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    let rejectRequest!: (reason: Error) => void
    context.getSnippetsById.mockImplementationOnce(
      () => new Promise((_resolve, reject) => (rejectRequest = reject)),
    )

    context.state.snippetId = 1
    await nextTick()

    expect(context.snippets.selectedSnippetRecordStatus.value).toBe('loading')
    expect(context.snippets.selectedSnippet.value?.id).toBe(1)

    rejectRequest(new Error('network'))
    await vi.waitFor(() => {
      expect(context.snippets.selectedSnippetRecordStatus.value).toBe('error')
      expect(context.snippets.selectedSnippet.value?.id).toBe(1)
    })
    consoleError.mockRestore()
  })

  it('exposes loading, error and ready states with retry', async () => {
    const context = await setup({ snippetId: 5 })
    const error = new Error('network')
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    context.getSnippetsById.mockRejectedValueOnce(error)

    const request = context.snippets.refreshSelectedSnippet()

    expect(context.snippets.selectedSnippetRecordStatus.value).toBe('loading')
    await request
    expect(context.snippets.selectedSnippetRecordStatus.value).toBe('error')

    await context.snippets.retrySelectedSnippet()

    expect(context.getSnippetsById).toHaveBeenCalledTimes(2)
    expect(context.snippets.selectedSnippetRecordStatus.value).toBe('ready')
    consoleError.mockRestore()
  })
})
