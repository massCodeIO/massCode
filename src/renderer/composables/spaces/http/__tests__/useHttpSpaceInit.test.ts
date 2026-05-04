import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

async function setup() {
  vi.resetModules()

  const isHttpSpaceInitialized = ref(true)
  const httpState = {
    requestId: 42,
  }
  const requests = ref([{ id: 42 }])

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
    }),
  }))
  vi.doMock('../useHttpRequests', () => ({
    useHttpRequests: () => ({
      getHttpRequests: vi.fn(async () => undefined),
      requests,
      resetHttpRequestsState,
      selectHttpRequest: vi.fn(),
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

  const { resetHttpSpaceState } = await import('../useHttpSpaceInit')

  return {
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
