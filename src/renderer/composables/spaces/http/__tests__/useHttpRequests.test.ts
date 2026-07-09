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
  const getHttpRequestsById = vi.fn(async () => ({ data: null as unknown }))

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
        getHttpRequestsById,
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
    getHttpRequestsById,
    useHttpRequests,
  }
}

function buildFullRequest(id: number, name: string) {
  return {
    id,
    name,
    folderId: null,
    method: 'GET',
    url: '',
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
    formData: [],
    auth: { type: 'none' },
    description: '',
    filePath: `${name}.md`,
    isFavorites: 0,
    isDeleted: 0,
    createdAt: 1,
    updatedAt: 1,
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

  it('keeps the editor draft when reloading the selected request fails', async () => {
    const context = await setup()
    const { selectHttpRequest, currentDraft } = context.useHttpRequests()

    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    selectHttpRequest(1)
    await vi.waitFor(() => expect(currentDraft.value?.name).toBe('Alpha'))

    // Транзиентный сбой загрузки не должен очищать форму всё ещё
    // выбранного запроса.
    context.getHttpRequestsById.mockRejectedValueOnce(new Error('transient'))
    selectHttpRequest(1)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(currentDraft.value?.name).toBe('Alpha')
  })

  it('keeps the newly selected request when a save of the previous one races', async () => {
    const context = await setup()
    const {
      selectHttpRequest,
      updateHttpRequest,
      currentDraft,
      currentRequest,
    } = context.useHttpRequests()

    // Загружен запрос A.
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    selectHttpRequest(1)
    await vi.waitFor(() => expect(currentRequest.value?.id).toBe(1))

    // Выбор B: его загрузка зависает до конца сценария.
    let resolveSelection!: (value: { data: unknown }) => void
    context.getHttpRequestsById.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSelection = resolve
        }) as never,
    )
    selectHttpRequest(2)

    // Автосейв A завершается, пока B грузится: post-save-обновление не
    // должно инвалидировать загрузку только что выбранного B.
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha Saved'),
    })
    await updateHttpRequest(1, { name: 'Alpha Saved' })

    resolveSelection({ data: buildFullRequest(2, 'Bravo') })
    await vi.waitFor(() => expect(currentDraft.value?.name).toBe('Bravo'))
    expect(currentRequest.value?.id).toBe(2)
  })
})
