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
    tagId: options.tagId,
  })

  const getSnippets = vi.fn(async () => ({
    data: [{ contents: [], id: 1, name: 'Search result', tags: [] }],
  }))

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
        patchSnippetsById: vi.fn(),
        patchSnippetsByIdContentsByContentId: vi.fn(),
        postSnippets: vi.fn(),
        postSnippetsByIdContents: vi.fn(),
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
