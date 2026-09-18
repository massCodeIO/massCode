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
      httpRuntimeNavigation: { confirmLeave: vi.fn(async () => true) },
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
      getHttpRequests: vi.fn(),
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
    search.clearSearch(true)
    await Promise.resolve()

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
    search.clearSearch(true)
    await Promise.resolve()
    expect(httpState.requestId).toBe(2)
  })
})
