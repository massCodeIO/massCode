import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, shallowRef, watch } from 'vue'

globalThis.computed = computed
globalThis.reactive = reactive
globalThis.ref = ref
globalThis.shallowRef = shallowRef
globalThis.watch = watch

interface SetupOptions {
  folderId?: number
  isSearch?: boolean
  libraryFilter?: string
  searchQuery?: string
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const httpState = reactive<{
    folderId?: number
    libraryFilter?: string
    requestId?: number
  }>({
    folderId: options.folderId,
    libraryFilter: options.libraryFilter,
  })
  const highlightedRequestIds = ref<Set<number>>(new Set())
  const isSearch = ref(options.isSearch ?? false)
  const searchQuery = ref(options.searchQuery ?? '')
  const getHttpRequests = vi.fn(async () => ({ data: [] }))

  // useContentSort читает store.app при импорте модуля: мокается целиком,
  // чтобы не тянуть electron store в тест.
  vi.doMock('@/composables/useContentSort', () => ({
    useContentSort: () => ({
      getContentSortQuery: () => ({}),
    }),
  }))

  vi.doMock('@/composables/useDialog', () => ({
    useDialog: () => ({
      confirm: vi.fn(async () => true),
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
    markUserEdit: vi.fn(),
  }))

  vi.doMock('@/electron', () => ({
    i18n: {
      t: (key: string) => key,
    },
  }))

  vi.doMock('@/services/api', () => ({
    api: {
      httpRequests: {
        deleteHttpRequestsById: vi.fn(),
        deleteHttpRequestsTrash: vi.fn(),
        getHttpRequests,
        getHttpRequestsById: vi.fn(),
        patchHttpRequestsById: vi.fn(),
        postHttpRequests: vi.fn(),
      },
    },
  }))

  vi.doMock('@/utils', () => ({
    getContiguousSelection: vi.fn(() => []),
  }))

  vi.doMock('@vueuse/core', () => ({
    useDebounceFn: (fn: () => void) => fn,
  }))

  vi.doMock('../useHttpApp', () => ({
    useHttpApp: () => ({
      focusRequestNameInput: vi.fn(),
      highlightedRequestIds,
      httpState,
    }),
  }))

  vi.doMock('../useHttpSearch', () => ({
    isSearch,
    requestsBySearch: ref(),
    searchQuery,
  }))

  const { useHttpRequests } = await import('../useHttpRequests')

  return {
    getHttpRequests,
    useHttpRequests,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHttpRequests', () => {
  it('combines search with the selected folder context', async () => {
    const context = await setup({
      folderId: 7,
      isSearch: true,
      searchQuery: 'auth',
    })

    await context.useHttpRequests().getHttpRequests()

    expect(context.getHttpRequests).toHaveBeenCalledWith({
      folderId: 7,
      search: 'auth',
    })
  })

  it('combines search with library filters', async () => {
    const context = await setup({
      isSearch: true,
      libraryFilter: 'favorites',
      searchQuery: 'token',
    })

    await context.useHttpRequests().getHttpRequests()

    expect(context.getHttpRequests).toHaveBeenCalledWith({
      isFavorites: 1,
      search: 'token',
    })
  })
})
