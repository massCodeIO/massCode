import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, { computed, ref, shallowRef, watch })

async function setup() {
  vi.resetModules()
  const currentRequest = shallowRef({
    id: 1,
    createdAt: 1,
    runtimeState: 'ready',
    runtimeRevision: 'missing',
    runtime: { version: 1, extractions: [], assertions: [] },
  })
  const currentDraft = ref({
    method: 'GET',
    url: 'https://example.test',
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
    formData: [],
    auth: { type: 'none' },
  })
  const invoke = vi.fn<(channel: string, payload: unknown) => Promise<object>>(
    async () => ({ status: 200, sessionNames: [] }),
  )
  const saveCurrentRequest = vi.fn()
  const putRuntime = vi.fn()
  const httpState: { requestId: number, activePanel?: 'request' | 'folder' } = {
    requestId: 1,
  }
  vi.doMock('../useHttpRequests', () => ({
    useHttpRequests: () => ({
      currentRequest,
      currentDraft,
      isCurrentRequestLoading: ref(false),
      isCurrentRequestDirty: ref(true),
      saveCurrentRequest,
      discardCurrentRequestChanges: vi.fn(),
    }),
  }))
  vi.doMock('../useHttpApp', () => ({
    useHttpApp: () => ({ httpState }),
  }))
  vi.doMock('../useHttpEnvironments', () => ({
    useHttpEnvironments: () => ({ activeEnvironmentId: ref(null) }),
  }))
  vi.doMock('../useHttpSettings', () => ({
    useHttpSettings: () => ({ settings: {} }),
  }))
  vi.doMock('../useHttpSession', () => ({
    useHttpSession: () => ({
      sessionNames: ref([]),
      resetHttpSessionNames: vi.fn(),
    }),
  }))
  vi.doMock('@/composables/useDonations', () => ({
    useDonations: () => ({ incrementSent: vi.fn() }),
  }))
  vi.doMock('@/composables/useSonner', () => ({
    useSonner: () => ({ sonner: vi.fn() }),
  }))
  vi.doMock('@/composables/useStorageMutation', () => ({
    markPersistedStorageMutation: vi.fn(),
  }))
  vi.doMock('@/electron', () => ({
    ipc: { invoke },
    i18n: { t: (key: string) => key },
  }))
  vi.doMock('@/services/api', () => ({
    api: { httpRequests: { putHttpRequestsByIdRuntime: putRuntime } },
  }))
  const runtime = (await import('../useHttpRuntime')).useHttpRuntime()
  const execute = (await import('../useHttpExecute')).useHttpExecute()
  return {
    runtime,
    execute,
    invoke,
    saveCurrentRequest,
    putRuntime,
    currentRequest,
    httpState,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('hTTP draft execution', () => {
  it('does not send the hidden request from a folder panel', async () => {
    const { execute, invoke, httpState } = await setup()
    httpState.activePanel = 'folder'
    expect(await execute.executeCurrentRequest()).toBeNull()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('cancels on selection change and waits for execution to settle before another Send', async () => {
    const { execute, invoke, currentRequest, httpState } = await setup()
    let finish!: (response: object) => void
    invoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const pending = execute.executeCurrentRequest()
    expect(execute.isExecuting.value).toBe(true)

    httpState.requestId = 2
    currentRequest.value = { ...currentRequest.value, id: 2 }
    expect(invoke).toHaveBeenCalledWith('spaces:http:cancel', undefined)
    // The cancellation acknowledgement does not release main's execution lock.
    await Promise.resolve()
    expect(execute.isExecuting.value).toBe(true)
    expect(await execute.executeCurrentRequest()).toBeNull()
    expect(
      invoke.mock.calls.filter(
        ([channel]) => channel === 'spaces:http:execute',
      ),
    ).toHaveLength(1)

    finish({ status: 200, sessionNames: ['stale'] })
    expect(await pending).toBeNull()
    expect(execute.lastResponse.value).toBeNull()
    expect(execute.isExecuting.value).toBe(false)
    expect(await execute.executeCurrentRequest()).not.toBeNull()
  })

  it('releases the busy state when invalidated execution rejects', async () => {
    const { execute, invoke } = await setup()
    let reject!: (error: Error) => void
    invoke.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        }),
    )
    const pending = execute.executeCurrentRequest()
    execute.resetHttpExecuteState()
    expect(execute.isExecuting.value).toBe(true)
    reject(new Error('aborted'))
    expect(await pending).toBeNull()
    expect(execute.isExecuting.value).toBe(false)
    expect(execute.lastError.value).toBeNull()
  })

  it('sends a snapshot of unsaved rules without saving or clearing dirty state', async () => {
    const { runtime, execute, invoke, saveCurrentRequest, putRuntime }
      = await setup()
    runtime.draft.value.assertions.push({
      name: 'Draft',
      source: 'status',
      operator: 'eq',
      expected: 201,
    })
    expect(await execute.executeCurrentRequest()).not.toBeNull()
    expect(invoke).toHaveBeenCalledWith(
      'spaces:http:execute',
      expect.objectContaining({
        runtime: {
          version: 1,
          extractions: [],
          assertions: [
            { name: 'Draft', source: 'status', operator: 'eq', expected: 201 },
          ],
        },
      }),
    )
    runtime.draft.value.assertions[0]!.expected = 202
    expect(invoke.mock.calls[0]?.[1]).toMatchObject({
      runtime: { assertions: [{ expected: 201 }] },
    })
    expect(runtime.requestDirty.value).toBe(true)
    expect(saveCurrentRequest).not.toHaveBeenCalled()
    expect(putRuntime).not.toHaveBeenCalled()
  })

  it('reveals invalid raw input and focuses its field without sending or saving', async () => {
    const { runtime, execute, invoke, saveCurrentRequest, putRuntime }
      = await setup()
    runtime.draft.value.assertions.push({
      name: 'Draft',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    runtime.setExpected(0, 'not JSON')
    expect(await execute.executeCurrentRequest()).toBeNull()
    expect(runtime.fieldError('assertions', 0, 'expected')).toBe(
      'expectedValue',
    )
    expect(runtime.focusTarget.value).toEqual({
      group: 'assertions',
      index: 0,
      field: 'expected',
    })
    expect(invoke).not.toHaveBeenCalled()
    expect(saveCurrentRequest).not.toHaveBeenCalled()
    expect(putRuntime).not.toHaveBeenCalled()
  })
})
