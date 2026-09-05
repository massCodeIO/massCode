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
    useHttpApp: () => ({ httpState: { requestId: 1 } }),
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
  return { runtime, execute, invoke, saveCurrentRequest, putRuntime }
}

beforeEach(() => vi.clearAllMocks())

describe('hTTP draft execution', () => {
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
