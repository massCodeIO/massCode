import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, {
  computed,
  nextTick,
  reactive,
  ref,
  shallowRef,
  watch,
})

interface SetupOptions {
  folderId?: number
  isSearch?: boolean
  libraryFilter?: string
  searchQuery?: string
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const httpState = reactive<{
    activePanel?: 'request' | 'folder'
    folderId?: number
    libraryFilter?: string
    requestId?: number
  }>({
    folderId: options.folderId,
    libraryFilter: options.libraryFilter,
  })
  const settings = reactive<{ transport: { encodeUrl?: boolean } }>({
    transport: {},
  })
  vi.doMock('../useHttpSettings', () => ({
    useHttpSettings: () => ({ settings }),
  }))
  const putHttpRequestsByIdRuntime = vi.fn(async () => ({
    data: { runtimeRevision: 'saved' },
  }))
  const confirm = vi.fn(async () => true)
  const deleteHttpRequestsById = vi.fn(async () => ({}))
  const highlightedRequestIds = ref<Set<number>>(new Set())
  const isSearch = ref(options.isSearch ?? false)
  const searchQuery = ref(options.searchQuery ?? '')
  const getHttpRequests = vi.fn(async () => ({ data: [] }))
  const getHttpRequestsById = vi.fn(async () => ({ data: null as unknown }))
  const postHttpRequests = vi.fn(async () => ({ data: { id: 2 } }))
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
      confirm,
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
      httpFolders: { getHttpFoldersTree: vi.fn(async () => ({ data: [] })) },
      httpRequests: {
        deleteHttpRequestsById,
        deleteHttpRequestsTrash: vi.fn(),
        getHttpRequests,
        getHttpRequestsById,
        patchHttpRequestsById,
        putHttpRequestsByIdRuntime,
        postHttpRequests,
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
    httpState,
    settings,
    putHttpRequestsByIdRuntime,
    confirm,
    deleteHttpRequestsById,
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
  it('refreshes the navigation metadata after mutations while searching', async () => {
    const ctx = await setup({ isSearch: true, searchQuery: 'renamed' })
    const data = ctx.useHttpRequests()
    const updated = buildFullRequest(7, 'renamed')
    ctx.getHttpRequests.mockResolvedValue({ data: [updated] as never[] })
    await data.updateHttpRequest(7, { name: 'renamed' })
    expect(ctx.getHttpRequests).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'renamed' }),
    )
    expect(ctx.getHttpRequests).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: 0 }),
    )
    expect(data.allRequests.value[0]).toMatchObject({ id: 7, name: 'renamed' })
  })

  it('opens folder settings without selecting its first request and returns to the same request', async () => {
    const ctx = await setup()
    const data = ctx.useHttpRequests()
    ctx.getHttpRequestsById.mockResolvedValue({
      data: buildFullRequest(1, 'One'),
    })
    await data.selectHttpRequest(1)
    const folders = (await import('../useHttpFolders')).useHttpFolders()
    folders.folders.value = [
      {
        id: 10,
        name: 'Collection',
        parentId: null,
        children: [],
        isOpen: 1,
        icon: null,
        createdAt: 1,
        updatedAt: 1,
        orderIndex: 0,
      },
    ]
    const calls = ctx.getHttpRequestsById.mock.calls.length
    expect(await folders.openHttpFolder(10)).toBe(true)
    expect(ctx.httpState.activePanel).toBe('folder')
    expect(data.currentRequest.value?.id).toBe(1)
    expect(ctx.getHttpRequestsById).toHaveBeenCalledTimes(calls)
    await data.selectHttpRequest(1)
    expect(ctx.httpState.activePanel).toBe('request')
  })

  it('keeps the panel on rejected navigation and ignores a request load superseded by a folder click', async () => {
    const ctx = await setup()
    const data = ctx.useHttpRequests()
    const folders = (await import('../useHttpFolders')).useHttpFolders()
    folders.folders.value = [
      {
        id: 10,
        name: 'Collection',
        parentId: null,
        children: [],
        isOpen: 1,
        icon: null,
        createdAt: 1,
        updatedAt: 1,
        orderIndex: 0,
      },
    ]
    const navigation = (await import('../runtimeNavigation'))
      .httpRuntimeNavigation
    navigation.confirmLeave = async () => false
    expect(await folders.openHttpFolder(10)).toBe(false)
    expect(ctx.httpState.activePanel).not.toBe('folder')
    navigation.confirmLeave = async () => true
    let finish!: (value: { data: unknown }) => void
    ctx.getHttpRequestsById.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const pending = data.selectHttpRequest(2)
    await Promise.resolve()
    await folders.openHttpFolder(10)
    finish({ data: buildFullRequest(2, 'Two') })
    await pending
    expect(ctx.httpState.activePanel).toBe('folder')
    expect(data.currentRequest.value).toBeNull()
  })

  it('saves names independently without committing or discarding content edits', async () => {
    const context = await setup()
    const requests = context.useHttpRequests()
    const record = buildFullRequest(1, 'Alpha')
    context.getHttpRequestsById.mockResolvedValueOnce({ data: record })
    await requests.selectHttpRequest(1)
    requests.currentDraft.value!.body = 'Unsaved body'
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: { ...record, name: 'Renamed' },
    })
    await requests.updateHttpRequest(1, { name: 'Renamed' })
    expect(context.patchHttpRequestsById).toHaveBeenLastCalledWith('1', {
      name: 'Renamed',
    })
    expect(requests.currentDraft.value!.body).toBe('Unsaved body')
    expect(requests.currentRequest.value!.name).toBe('Renamed')
    expect(requests.isCurrentRequestDirty.value).toBe(true)

    await requests.saveCurrentRequest()
    expect(context.patchHttpRequestsById.mock.lastCall![1]).not.toHaveProperty(
      'name',
    )
    expect(requests.isCurrentRequestDirty.value).toBe(false)
    expect(requests.currentRequest.value!.name).toBe('Renamed')
  })

  it('trashes an untouched request from a folder without reporting unsaved changes', async () => {
    const context = await setup({ folderId: 10 })
    const requests = context.useHttpRequests()
    const record = { ...buildFullRequest(1, 'Untitled'), folderId: 10 }
    context.getHttpRequestsById.mockResolvedValueOnce({ data: record })
    await requests.selectHttpRequest(1)
    expect(requests.isCurrentRequestDirty.value).toBe(false)
    const { httpRuntimeNavigation } = await import('../runtimeNavigation')
    const dirtyAtNavigation: boolean[] = []
    httpRuntimeNavigation.confirmLeave = async () => {
      dirtyAtNavigation.push(requests.isCurrentRequestDirty.value)
      return !requests.isCurrentRequestDirty.value
    }
    context.getHttpRequestsById.mockResolvedValueOnce({
      data: { ...record, folderId: null, isDeleted: 1 },
    })

    await requests.deleteSelectedHttpRequests(record as never)
    await Promise.resolve()

    expect(context.patchHttpRequestsById).toHaveBeenCalledWith('1', {
      folderId: null,
      isDeleted: 1,
    })
    expect(dirtyAtNavigation).toEqual([false, false])
    expect(requests.currentRequest.value).toBeNull()

    context.getHttpRequestsById.mockResolvedValueOnce({
      data: { ...buildFullRequest(2, 'Next request'), folderId: 10 },
    })
    await requests.createHttpRequestAndSelect({ folderId: 10 })
    expect(requests.currentRequest.value?.id).toBe(2)
    expect(requests.isCurrentRequestDirty.value).toBe(false)
    expect(dirtyAtNavigation).toEqual([false, false, false])
  })

  it('preserves edits made while a metadata refresh is pending', async () => {
    const context = await setup()
    const requests = context.useHttpRequests()
    const record = buildFullRequest(1, 'Alpha')
    context.getHttpRequestsById.mockResolvedValueOnce({ data: record })
    await requests.selectHttpRequest(1)
    let finish!: (value: { data: unknown }) => void
    context.getHttpRequestsById.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const update = requests.updateHttpRequest(1, { isFavorites: 1 })
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    requests.currentDraft.value!.description = 'Keep this edit'
    finish({ data: { ...record, isFavorites: 1 } })
    await update
    expect(requests.currentDraft.value!.description).toBe('Keep this edit')
    expect(requests.isCurrentRequestDirty.value).toBe(true)
  })

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
    const { selectHttpRequest } = context.useHttpRequests()

    context.getHttpRequestsById.mockResolvedValueOnce({
      data: buildFullRequest(1, 'Alpha'),
    })
    selectHttpRequest(1)
    await vi.waitFor(() =>
      expect(context.useHttpRequests().currentRequest.value?.name).toBe(
        'Alpha',
      ),
    )

    // Транзиентный сбой загрузки не должен очищать форму всё ещё
    // выбранного запроса.
    context.getHttpRequestsById.mockRejectedValueOnce(new Error('transient'))
    selectHttpRequest(1)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(context.useHttpRequests().currentRequest.value?.name).toBe('Alpha')
  })

  it('keeps the newly selected request when a save of the previous one races', async () => {
    const context = await setup()
    const { selectHttpRequest, updateHttpRequest, currentRequest }
      = context.useHttpRequests()

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
    await vi.waitFor(() =>
      expect(context.useHttpRequests().currentRequest.value?.name).toBe(
        'Bravo',
      ),
    )
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
  it.each([false, true])(
    'keeps URL/Params synchronized after an identical reload (discard: %s)',
    async (discard) => {
      const ctx = await setup()
      const requests = ctx.useHttpRequests()
      const record = {
        ...buildFullRequest(1, 'URL'),
        url: 'https://api.test/',
        query: [{ key: 'old', value: 'yes', enabled: true, description: '' }],
      }
      ctx.getHttpRequestsById.mockResolvedValue({ data: record })
      await requests.selectHttpRequest(1)
      await nextTick()
      if (discard)
        requests.discardCurrentRequestChanges()
      else await requests.selectHttpRequest(1)
      await nextTick()
      requests.currentDraft.value!.url = 'https://api.test/redirect'
      expect(requests.currentDraft.value!.query).toEqual([])
      expect(await requests.saveCurrentRequest()).toBe(true)
      expect(requests.isCurrentRequestDirty.value).toBe(false)
      expect(ctx.patchHttpRequestsById).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          url: 'https://api.test/redirect',
          query: [],
        }),
      )
      requests.currentDraft.value!.query.push({
        key: 'next',
        value: 'a&b+#%',
        enabled: true,
      })
      expect(requests.currentDraft.value!.url).toBe(
        'https://api.test/redirect?next=a%26b%2B%23%25',
      )
    },
  )
  it('saves a noncanonical encoded URL once without leaving the editor dirty', async () => {
    const ctx = await setup()
    const requests = ctx.useHttpRequests()
    ctx.getHttpRequestsById.mockResolvedValue({
      data: { ...buildFullRequest(1, 'URL'), url: 'https://api.test/' },
    })
    await requests.selectHttpRequest(1)
    requests.currentDraft.value!.url
      = 'https://api.test/?value=a%26b%3dc%2bd%25&space=a+b&dup=1&dup=2'
    expect(await requests.saveCurrentRequest()).toBe(true)
    expect(requests.isCurrentRequestDirty.value).toBe(false)
    expect(ctx.patchHttpRequestsById).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        url: 'https://api.test/',
        query: expect.arrayContaining([
          expect.objectContaining({ key: 'value', value: 'a&b=c+d%' }),
          expect.objectContaining({ key: 'space', value: 'a b' }),
        ]),
      }),
    )
  })
  it.each([false, true])(
    'confirms deletion of selected Trash records outside its scope (cancel: %s)',
    async (cancel) => {
      const ctx = await setup({ folderId: 1 })
      ctx.httpState.activePanel = 'folder'
      const requests = ctx.useHttpRequests()
      requests.trashRequests.value = [2, 3].map(id => ({
        ...buildFullRequest(id, `Trash ${id}`),
        isDeleted: 1,
      })) as never
      requests.selectedRequestIds.value = [2, 3]
      ctx.confirm.mockResolvedValue(!cancel)
      await requests.deleteSelectedHttpRequests()
      expect(ctx.confirm).toHaveBeenCalledOnce()
      expect(ctx.patchHttpRequestsById).not.toHaveBeenCalled()
      expect(ctx.deleteHttpRequestsById).toHaveBeenCalledTimes(cancel ? 0 : 2)
    },
  )
  it('confirms single Trash deletion and never permanently deletes mixed active/Trash selection', async () => {
    const ctx = await setup({ folderId: 1 })
    const requests = ctx.useHttpRequests()
    requests.trashRequests.value = [
      { ...buildFullRequest(2, 'Trash'), isDeleted: 1 },
    ] as never
    requests.selectedRequestIds.value = [2]
    await requests.deleteSelectedHttpRequests()
    expect(ctx.confirm).toHaveBeenCalledOnce()
    expect(ctx.deleteHttpRequestsById).toHaveBeenCalledWith('2')
    ctx.confirm.mockClear()
    ctx.deleteHttpRequestsById.mockClear()
    requests.allRequests.value = [buildFullRequest(1, 'Active')] as never
    requests.trashRequests.value = [
      { ...buildFullRequest(2, 'Trash'), isDeleted: 1 },
    ] as never
    requests.selectedRequestIds.value = [1, 2]
    await requests.deleteSelectedHttpRequests()
    expect(ctx.deleteHttpRequestsById).not.toHaveBeenCalled()
    expect(ctx.patchHttpRequestsById).toHaveBeenCalledWith('1', {
      folderId: null,
      isDeleted: 1,
    })
  })
  it.each(['global', 'persisted', 'draft'] as const)(
    'preserves raw query bytes with the %s encoding setting',
    async (source) => {
      const ctx = await setup()
      if (source === 'global')
        ctx.settings.transport.encodeUrl = false
      const requests = ctx.useHttpRequests()
      const record = {
        ...buildFullRequest(1, 'Raw URL'),
        url: 'https://api.test/',
        runtimeState: 'ready',
        runtimeRevision: 'initial',
        runtime: {
          version: 1,
          extractions: [],
          assertions: [],
          transport: source === 'persisted' ? { encodeUrl: false } : {},
        },
      }
      ctx.getHttpRequestsById.mockResolvedValue({ data: record })
      await requests.selectHttpRequest(1)
      const runtime = (await import('../useHttpRuntime')).useHttpRuntime()
      if (source === 'draft')
        runtime.draft.value.transport = { encodeUrl: false }
      const url = 'https://api.test/?q=a%20b+c&literal=a%26b&dup=1&dup=2'
      requests.currentDraft.value!.url = url
      expect(
        requests.currentDraft.value!.query.map(({ key, value }) => ({
          key,
          value,
        })),
      ).toEqual([
        { key: 'q', value: 'a%20b+c' },
        { key: 'literal', value: 'a%26b' },
        { key: 'dup', value: '1' },
        { key: 'dup', value: '2' },
      ])
      requests.currentDraft.value!.query[0]!.description = 'Keep raw bytes'
      expect(requests.currentDraft.value!.url).toBe(url)
      expect(await runtime.saveRequest()).toBe(true)
      expect(requests.isCurrentRequestDirty.value).toBe(false)
      expect(runtime.requestDirty.value).toBe(false)
      const saved = JSON.parse(JSON.stringify(requests.currentRequest.value))
      ctx.getHttpRequestsById.mockResolvedValue({ data: saved })
      await requests.selectHttpRequest(1)
      expect(requests.currentDraft.value!.url).toBe(url)
      expect(requests.currentDraft.value!.query[0]!.value).toBe('a%20b+c')
      expect(ctx.patchHttpRequestsById).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          query: expect.arrayContaining([
            expect.objectContaining({ key: 'q', value: 'a%20b+c' }),
          ]),
        }),
      )
    },
  )
  it('keeps literal Params unchanged when an unsaved runtime override changes', async () => {
    const ctx = await setup()
    const requests = ctx.useHttpRequests()
    const record = {
      ...buildFullRequest(1, 'Toggle URL encoding'),
      url: 'https://api.test/',
      query: [{ key: 'q', value: 'a&b+c%', enabled: true, description: '' }],
      runtimeState: 'ready',
      runtimeRevision: 'initial',
      runtime: { version: 1, extractions: [], assertions: [], transport: {} },
    }
    ctx.getHttpRequestsById.mockResolvedValue({ data: record })
    await requests.selectHttpRequest(1)
    const runtime = (await import('../useHttpRuntime')).useHttpRuntime()
    expect(requests.currentDraft.value!.url).toBe(
      'https://api.test/?q=a%26b%2Bc%25',
    )
    runtime.draft.value.transport = { encodeUrl: false }
    expect(requests.currentDraft.value!.query[0]!.value).toBe('a&b+c%')
    expect(requests.currentDraft.value!.url).toBe('https://api.test/?q=a&b+c%')
    expect(requests.isCurrentRequestDirty.value).toBe(false)
    runtime.draft.value.transport.encodeUrl = true
    expect(requests.currentDraft.value!.query[0]!.value).toBe('a&b+c%')
    expect(requests.isCurrentRequestDirty.value).toBe(false)
    runtime.draft.value.transport.encodeUrl = false
    const leaving = (
      await import('../runtimeNavigation')
    ).httpRuntimeNavigation.confirmLeave()
    await runtime.resolveNavigation('discard')
    expect(await leaving).toBe(true)
    expect(runtime.requestDirty.value).toBe(false)
    expect(requests.currentDraft.value!.query[0]!.value).toBe('a&b+c%')
  })
  it('keeps literal Params unchanged when the inherited global encoding setting changes', async () => {
    const ctx = await setup()
    const requests = ctx.useHttpRequests()
    ctx.getHttpRequestsById.mockResolvedValue({
      data: {
        ...buildFullRequest(1, 'Global URL'),
        url: 'https://api.test/',
        query: [{ key: 'q', value: 'a&b+c%', enabled: true }],
      },
    })
    await requests.selectHttpRequest(1)
    ctx.settings.transport.encodeUrl = false
    expect(requests.currentDraft.value!.query[0]!.value).toBe('a&b+c%')
    expect(requests.currentDraft.value!.url).toBe('https://api.test/?q=a&b+c%')
    expect(requests.isCurrentRequestDirty.value).toBe(false)
  })
})
