import { describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'

globalThis.computed = computed
globalThis.ref = ref
globalThis.shallowRef = shallowRef

describe('useHttpSearch', () => {
  it('discards the previous vault search and snapshot on reset', async () => {
    vi.resetModules()
    const httpState = { requestId: 1, folderId: 10 }
    const stateSnapshots = { beforeSearch: {} }
    const requests = ref([{ id: 1 }])
    const isRestoreStateBlocked = ref(false)
    const selectHttpRequest = vi.fn()

    vi.doMock('../runtimeNavigation', () => ({
      httpRuntimeNavigation: {
        confirmLeave: vi.fn(async () => true),
        transitionToken: 0,
      },
    }))
    vi.doMock('../useHttpApp', () => ({
      useHttpApp: () => ({
        httpState,
        stateSnapshots,
        saveHttpStateSnapshot: () => {
          stateSnapshots.beforeSearch = { ...httpState }
        },
        restoreHttpStateSnapshot: () =>
          Object.assign(httpState, stateSnapshots.beforeSearch),
      }),
    }))
    vi.doMock('../useHttpRequests', () => ({
      getHttpRequests: vi.fn(async () => true),
      isRestoreStateBlocked,
      requests,
      selectFirstRequest: vi.fn(),
      selectHttpRequest,
      useHttpRequests: vi.fn(),
    }))

    const { useHttpSearch, requestsBySearch } = await import(
      '../useHttpSearch'
    )
    const search = useHttpSearch()
    search.searchQuery.value = 'old vault'
    await search.search()
    requestsBySearch.value = [{ id: 1 }] as any

    search.resetHttpSearchState()
    Object.assign(httpState, { requestId: 2, folderId: 20 })
    requests.value = [{ id: 2 }]
    await search.clearSearch(true)

    expect(search.searchQuery.value).toBe('')
    expect(search.isSearch.value).toBe(false)
    expect(search.searchSelectedIndex.value).toBe(-1)
    expect(requestsBySearch.value).toBeUndefined()
    expect(search.displayedRequests.value).toEqual([{ id: 2 }])
    expect(httpState).toEqual({ requestId: 2, folderId: 20 })
    expect(selectHttpRequest).toHaveBeenCalledWith(2, false, {
      preservePanel: true,
    })

    search.searchQuery.value = 'new vault'
    await search.search()
    httpState.requestId = 3
    await search.clearSearch(true)
    expect(httpState.requestId).toBe(2)
  })
})

it('keeps search and selection intact while cancellation of restoration is pending', async () => {
  vi.resetModules()
  let resolve!: (value: boolean) => void
  const pending = new Promise<boolean>((done) => {
    resolve = done
  })
  const restore = vi.fn()
  vi.doMock('../runtimeNavigation', () => ({
    httpRuntimeNavigation: { transitionToken: 0, confirmLeave: () => pending },
  }))
  vi.doMock('../useHttpApp', () => ({
    useHttpApp: () => ({
      httpState: { requestId: 2 },
      saveHttpStateSnapshot: vi.fn(),
      restoreHttpStateSnapshot: restore,
      stateSnapshots: { beforeSearch: {} },
    }),
  }))
  vi.doMock('../useHttpRequests', () => ({
    getHttpRequests: vi.fn(),
    isRestoreStateBlocked: ref(false),
    requests: ref([]),
    selectFirstRequest: vi.fn(),
    selectHttpRequest: vi.fn(),
    useHttpRequests: vi.fn(),
  }))
  const search = (await import('../useHttpSearch')).useHttpSearch()
  search.searchQuery.value = 'keep'
  search.isSearch.value = true
  const clearing = search.clearSearch(true)
  expect(search.searchQuery.value).toBe('keep')
  resolve(false)
  expect(await clearing).toBe(false)
  expect(search.searchQuery.value).toBe('keep')
  expect(search.isSearch.value).toBe(true)
  expect(restore).not.toHaveBeenCalled()
})
