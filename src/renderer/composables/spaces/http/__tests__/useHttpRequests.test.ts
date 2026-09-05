import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, { computed, reactive, ref, shallowRef, watch })

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
  const patchHttpRequestsById = vi.fn<
    (id: string, data: unknown) => Promise<object>
  >(async () => ({}))

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
        patchHttpRequestsById,
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
    patchHttpRequestsById,
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
  it('keeps edits local until explicit save and updates the baseline without a GET', async () => {
    const context = await setup()
    const {
      selectHttpRequest,
      currentDraft,
      isCurrentRequestDirty,
      saveCurrentRequest,
    } = context.useHttpRequests()
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    await selectHttpRequest(1)
    currentDraft.value!.description = 'Local changes'
    await new Promise(resolve => setTimeout(resolve, 600))
    expect(context.patchHttpRequestsById).not.toHaveBeenCalled()
    expect(isCurrentRequestDirty.value).toBe(true)
    expect(await saveCurrentRequest()).toBe(true)
    expect(context.patchHttpRequestsById).toHaveBeenCalledTimes(1)
    expect(isCurrentRequestDirty.value).toBe(false)
    expect(context.getHttpRequestsById).toHaveBeenCalledTimes(1)
  })

  it('retains changes after a rejected explicit save', async () => {
    const context = await setup()
    const {
      selectHttpRequest,
      currentDraft,
      isCurrentRequestDirty,
      saveCurrentRequest,
    } = context.useHttpRequests()
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    await selectHttpRequest(1)
    currentDraft.value!.description = 'Local changes'
    context.patchHttpRequestsById.mockRejectedValueOnce({
      response: { status: 400 },
    })
    expect(await saveCurrentRequest()).toBe(false)
    expect(isCurrentRequestDirty.value).toBe(true)
    expect(currentDraft.value!.description).toBe('Local changes')
  })

  it('keeps edits made during saving dirty, including nested fields', async () => {
    const context = await setup()
    const {
      selectHttpRequest,
      currentDraft,
      isCurrentRequestDirty,
      saveCurrentRequest,
    } = context.useHttpRequests()
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    await selectHttpRequest(1)
    currentDraft.value!.headers = [
      { key: 'X-Test', value: 'first', enabled: true },
    ]
    let finish!: () => void
    context.patchHttpRequestsById.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({})
        }),
    )
    const pending = saveCurrentRequest()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    currentDraft.value!.headers[0]!.value = 'second'
    finish()
    expect(await pending).toBe(true)
    expect(context.patchHttpRequestsById.mock.calls[0]?.[1]).toMatchObject({
      headers: [{ value: 'first' }],
    })
    expect(isCurrentRequestDirty.value).toBe(true)
  })

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

    await vi.waitFor(() => expect(resolveSelection).toBeTypeOf('function'))

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

  it('keeps selection on cancelled runtime navigation, including clearing the editor', async () => {
    const context = await setup()
    const { httpRuntimeNavigation } = await import('../runtimeNavigation')
    const { selectHttpRequest, currentRequest } = context.useHttpRequests()
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    await selectHttpRequest(1)
    httpRuntimeNavigation.confirmLeave = vi.fn(async () => false)
    await selectHttpRequest(2)
    await selectHttpRequest(undefined)
    expect(currentRequest.value?.id).toBe(1)
    expect(context.getHttpRequestsById).toHaveBeenCalledTimes(1)
  })

  it('applies only the latest destination after runtime confirmation', async () => {
    const context = await setup()
    const { httpRuntimeNavigation } = await import('../runtimeNavigation')
    const { selectHttpRequest, currentRequest } = context.useHttpRequests()
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    await selectHttpRequest(1)
    let allow!: (value: boolean) => void
    const confirmation = new Promise<boolean>((resolve) => {
      allow = resolve
    })
    httpRuntimeNavigation.confirmLeave = () => confirmation
    const second = selectHttpRequest(2)
    const third = selectHttpRequest(3)
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(3, 'Charlie'),
    })
    allow(true)
    await Promise.all([second, third])
    expect(currentRequest.value?.id).toBe(3)
    expect(context.getHttpRequestsById).not.toHaveBeenCalledWith('2')
  })
})
