import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

async function setup() {
  vi.resetModules()

  const isHttpSpaceInitialized = ref(true)
  const httpState: {
    requestId?: number
    folderId?: number
    activePanel?: 'request' | 'folder'
  } = {
    requestId: 42,
  }
  const requests = ref([{ id: 42 }])
  const allRequests = ref([{ id: 42 }])

  const selectHttpRequest = vi.fn()
  const resetHttpFoldersState = vi.fn()
  const resetHttpRequestsState = vi.fn(() => {
    requests.value = []
    httpState.requestId = undefined
  })
  const resetHttpEnvironmentsState = vi.fn()
  const resetHttpHistoryState = vi.fn()
  const resetHttpExecuteState = vi.fn()
  const resetHttpSearchState = vi.fn()

  vi.doMock('../useHttpApp', () => ({
    useHttpApp: () => ({
      httpState,
      isHttpSpaceInitialized,
    }),
  }))
  vi.doMock('../useHttpFolders', () => ({
    useHttpFolders: () => ({
      getHttpFolders: vi.fn(async () => undefined),
      resetHttpFoldersState,
      folders: ref([{ id: 10 }]),
      getFolderByIdFromTree: (_folders: unknown, id: number) =>
        id === 10 ? { id: 10 } : undefined,
    }),
  }))
  vi.doMock('../useHttpRequests', () => ({
    useHttpRequests: () => ({
      getHttpRequests: vi.fn(async () => undefined),
      getAllHttpRequests: vi.fn(async () => undefined),
      requests,
      allRequests,
      resetHttpRequestsState,
      selectHttpRequest,
    }),
  }))
  vi.doMock('../useHttpEnvironments', () => ({
    useHttpEnvironments: () => ({
      getHttpEnvironments: vi.fn(async () => undefined),
      resetHttpEnvironmentsState,
    }),
  }))
  vi.doMock('../useHttpHistory', () => ({
    useHttpHistory: () => ({
      getHttpHistory: vi.fn(async () => undefined),
      resetHttpHistoryState,
    }),
  }))
  vi.doMock('../useHttpExecute', () => ({
    useHttpExecute: () => ({
      resetHttpExecuteState,
    }),
  }))
  vi.doMock('../useHttpSearch', () => ({
    useHttpSearch: () => ({
      resetHttpSearchState,
    }),
  }))

  const { resetHttpSpaceState, useHttpSpaceInit } = await import(
    '../useHttpSpaceInit'
  )

  return {
    httpState,
    allRequests,
    requests,
    selectHttpRequest,
    refresh: useHttpSpaceInit().refreshHttpSpaceFromDisk,
    isHttpSpaceInitialized,
    resetHttpEnvironmentsState,
    resetHttpExecuteState,
    resetHttpFoldersState,
    resetHttpHistoryState,
    resetHttpRequestsState,
    resetHttpSearchState,
    resetHttpSpaceState,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resetHttpSpaceState', () => {
  it('restores the saved request before the navigation list is populated', async () => {
    const ctx = await setup()
    ctx.requests.value = []
    ctx.allRequests.value = []
    await ctx.refresh()
    expect(ctx.selectHttpRequest).toHaveBeenCalledWith(42, false, {
      preservePanel: true,
    })
  })

  it.each([10, 20])(
    'keeps a request outside the filtered list in folder %s',
    async (folderId) => {
      const ctx = await setup()
      ctx.httpState.folderId = folderId
      ctx.requests.value = [{ id: 99 }]
      await ctx.refresh()
      expect(ctx.selectHttpRequest).toHaveBeenCalledWith(42, false, {
        preservePanel: true,
      })
    },
  )

  it('does not restore a stale selection after navigation during refresh', async () => {
    const ctx = await setup()
    const pending = ctx.refresh()
    ctx.httpState.requestId = 99
    await pending
    expect(ctx.selectHttpRequest).not.toHaveBeenCalled()
  })

  it('preserves folder settings during sync even when the hidden request is outside the folder', async () => {
    const ctx = await setup()
    ctx.httpState.activePanel = 'folder'
    ctx.httpState.folderId = 10
    ctx.requests.value = [{ id: 99 }]
    await ctx.refresh()
    expect(ctx.httpState.activePanel).toBe('folder')
    expect(ctx.httpState.requestId).toBe(42)
    expect(ctx.selectHttpRequest).not.toHaveBeenCalled()
  })

  it('clears every module-level HTTP space state slice', async () => {
    const context = await setup()

    context.resetHttpSpaceState()

    expect(context.isHttpSpaceInitialized.value).toBe(false)
    expect(context.resetHttpSearchState).toHaveBeenCalledTimes(1)
    expect(context.resetHttpExecuteState).toHaveBeenCalledTimes(1)
    expect(context.resetHttpRequestsState).toHaveBeenCalledTimes(1)
    expect(context.resetHttpFoldersState).toHaveBeenCalledTimes(1)
    expect(context.resetHttpEnvironmentsState).toHaveBeenCalledTimes(1)
    expect(context.resetHttpHistoryState).toHaveBeenCalledTimes(1)
  })
})
