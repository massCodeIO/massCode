import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, { computed, ref, watch })

const putRuntime = vi.fn()
const currentRequest = shallowRef<any>(null)
function request() {
  return {
    id: 1,
    createdAt: 1,
    runtimeState: 'ready',
    runtimeRevision: 'missing',
    runtime: { version: 1, extractions: [], assertions: [] },
  }
}

async function load() {
  vi.resetModules()
  vi.doMock('../useHttpRequests', () => ({
    useHttpRequests: () => ({ currentRequest }),
  }))
  vi.doMock('@/composables/useStorageMutation', () => ({
    markPersistedStorageMutation: vi.fn(),
  }))
  vi.doMock('@/services/api', () => ({
    api: { httpRequests: { putHttpRequestsByIdRuntime: putRuntime } },
  }))
  return (await import('../useHttpRuntime')).useHttpRuntime()
}

describe('hTTP runtime editor state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRequest.value = request()
    putRuntime.mockResolvedValue({
      data: { runtimeRevision: 'saved-revision' },
    })
  })

  it('saves independent rules and clears dirty state only after success', async () => {
    const runtime = await load()
    runtime.draft.value.assertions.push({
      name: 'status',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    expect(runtime.dirty.value).toBe(true)
    expect(await runtime.saveRuntime()).toBe(true)
    expect(putRuntime).toHaveBeenCalledWith('1', {
      runtime: runtime.draft.value,
      expectedRevision: 'missing',
    })
    expect(runtime.dirty.value).toBe(false)
    expect(currentRequest.value.runtime.assertions).toHaveLength(1)
  })

  it('retains edits on save failure and blocks unavailable runtimes', async () => {
    const runtime = await load()
    runtime.draft.value.extractions.push({
      name: 'token',
      source: 'json',
      path: '/token',
    })
    putRuntime.mockRejectedValueOnce(new Error('conflict'))
    expect(await runtime.saveRuntime()).toBe(false)
    expect(runtime.dirty.value).toBe(true)
    expect(runtime.saveError.value).toBe(true)
    currentRequest.value = {
      ...request(),
      runtimeState: 'unsupported',
      runtime: null,
    }
    expect(await runtime.saveRuntime()).toBe(false)
    expect(putRuntime).toHaveBeenCalledTimes(1)
  })

  it('does not apply an old save after leaving and reopening the same request', async () => {
    const runtime = await load()
    runtime.draft.value.extractions.push({
      name: 'token',
      source: 'json',
      path: '/token',
    })
    let resolve!: (value: unknown) => void
    putRuntime.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const saving = runtime.saveRuntime()
    currentRequest.value = null
    currentRequest.value = request()
    resolve({ data: { runtimeRevision: 'saved-revision' } })
    await saving
    expect(currentRequest.value.runtime.extractions).toEqual([])
    expect(runtime.draft.value.extractions).toEqual([])
  })

  it('retains the loaded revision when external sync occurs with dirty edits', async () => {
    const runtime = await load()
    runtime.draft.value.extractions.push({
      name: 'token',
      source: 'json',
      path: '/token',
    })
    currentRequest.value = {
      ...request(),
      runtimeRevision: 'external-revision',
    }
    putRuntime.mockRejectedValueOnce({ response: { status: 409 } })
    expect(await runtime.saveRuntime()).toBe(false)
    expect(putRuntime.mock.calls[0]![1].expectedRevision).toBe('missing')
    expect(runtime.conflict.value).toBe(true)
    expect(runtime.dirty.value).toBe(true)
  })

  it('ignores hidden expected validation for Exists and preserves concurrent request updates', async () => {
    const runtime = await load()
    runtime.draft.value.assertions.push({
      name: 'expected',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    runtime.setExpected(0, 'invalid')
    expect(runtime.valid.value).toBe(false)
    runtime.draft.value.assertions[0]!.operator = 'exists'
    expect(runtime.valid.value).toBe(true)
    let resolve!: (value: unknown) => void
    putRuntime.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const saving = runtime.saveRuntime()
    currentRequest.value = {
      ...currentRequest.value,
      name: 'Updated during save',
    }
    resolve({ data: { runtimeRevision: 'saved' } })
    expect(await saving).toBe(true)
    expect(currentRequest.value.name).toBe('Updated during save')
  })

  it.each(['"text"', 'true', 'null'])(
    'keeps intermediate expected input while typing %s',
    async (text) => {
      const runtime = await load()
      runtime.draft.value.assertions.push({
        name: 'expected',
        source: 'status',
        operator: 'eq',
        expected: 200,
      })
      for (let length = 1; length <= text.length; length += 1) {
        runtime.setExpected(0, text.slice(0, length))
        expect(runtime.expectedInputs.value[0]).toBe(text.slice(0, length))
        expect(runtime.valid.value).toBe(length === text.length)
      }
      expect(runtime.draft.value.assertions[0]!.expected).toEqual(
        JSON.parse(text),
      )
    },
  )
})
