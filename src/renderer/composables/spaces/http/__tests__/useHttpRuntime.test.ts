import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, { computed, ref, watch })

const putRuntime = vi.fn()
const currentRequest = shallowRef<any>(null)
const isCurrentRequestDirty = ref(false)
const saveCurrentRequest = vi.fn(async () => {
  isCurrentRequestDirty.value = false
  return true
})
const discardCurrentRequestChanges = vi.fn(() => {
  isCurrentRequestDirty.value = false
})
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
    useHttpRequests: () => ({
      currentRequest,
      isCurrentRequestDirty,
      saveCurrentRequest,
      discardCurrentRequestChanges,
    }),
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
  it('blocks direct reload for dirty drafts and pending saves', async () => {
    const addEventListener = vi.fn()
    vi.stubGlobal('window', { addEventListener })
    try {
      const runtime = await load()
      const beforeUnload = addEventListener.mock.calls.find(
        ([event]) => event === 'beforeunload',
      )![1]
      const event = { preventDefault: vi.fn(), returnValue: undefined }
      beforeUnload(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
      isCurrentRequestDirty.value = true
      beforeUnload(event)
      expect(event.preventDefault).toHaveBeenCalledOnce()
      isCurrentRequestDirty.value = false
      runtime.saving.value = true
      beforeUnload(event)
      expect(event.preventDefault).toHaveBeenCalledTimes(2)
      runtime.saving.value = false
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it.each([
    'save',
    'discard',
    'cancel',
    'failed-save',
    'invalid',
    'busy',
  ] as const)(
    'acknowledges lifecycle %s only after the runtime guard resolves',
    async (choice) => {
      const runtime = await load()
      isCurrentRequestDirty.value = true
      const send = vi.fn()
      const on = vi.fn()
      vi.doMock('@/electron', () => ({ ipc: { on, send } }))
      const { registerLifecycleListener } = await import(
        '@/ipc/listeners/lifecycle'
      )
      registerLifecycleListener()
      const listener = on.mock.calls[0]![1]
      if (choice === 'failed-save')
        saveCurrentRequest.mockResolvedValueOnce(false)
      if (choice === 'invalid') {
        runtime.draft.value.extractions.push({
          name: '',
          source: 'json',
          path: '',
        })
      }
      if (choice === 'busy')
        runtime.saving.value = true
      const pending = listener(undefined, { id: 42 })
      await Promise.resolve()
      expect(send).not.toHaveBeenCalled()
      if (choice !== 'busy') {
        expect(runtime.leaveDialogOpen.value).toBe(true)
        await runtime.resolveNavigation(
          choice === 'failed-save' || choice === 'invalid' ? 'save' : choice,
        )
      }
      await pending
      expect(send).toHaveBeenCalledWith('system:confirm-leave-result', {
        id: 42,
        allowed: choice === 'save' || choice === 'discard',
      })
      if (choice !== 'save' && choice !== 'discard')
        expect(runtime.requestDirty.value).toBe(true)
      runtime.saving.value = false
    },
  )

  it('saves request fields and runtime with one action', async () => {
    const runtime = await load()
    isCurrentRequestDirty.value = true
    runtime.draft.value.assertions.push({
      name: 'Status',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    expect(runtime.requestDirty.value).toBe(true)
    expect(await runtime.saveRequest()).toBe(true)
    expect(saveCurrentRequest).toHaveBeenCalledTimes(1)
    expect(putRuntime).toHaveBeenCalledTimes(1)
    expect(runtime.requestDirty.value).toBe(false)
  })

  it('validates runtime before writing any request fields', async () => {
    const runtime = await load()
    isCurrentRequestDirty.value = true
    runtime.draft.value.extractions.push({
      name: '',
      source: 'json',
      path: '',
    })
    expect(await runtime.saveRequest()).toBe(false)
    expect(saveCurrentRequest).not.toHaveBeenCalled()
    expect(putRuntime).not.toHaveBeenCalled()
    expect(runtime.focusTarget.value?.group).toBe('extractions')
  })

  it('keeps runtime edits when saving request fields fails', async () => {
    const runtime = await load()
    isCurrentRequestDirty.value = true
    runtime.draft.value.extractions.push({
      name: 'token',
      source: 'json',
      path: '',
    })
    saveCurrentRequest.mockResolvedValueOnce(false)
    expect(await runtime.saveRequest()).toBe(false)
    expect(runtime.requestSaveError.value).toBe(true)
    expect(runtime.requestDirty.value).toBe(true)
    expect(putRuntime).not.toHaveBeenCalled()
  })

  it('keeps unsaved runtime after a partial save and retries it', async () => {
    const runtime = await load()
    isCurrentRequestDirty.value = true
    runtime.draft.value.extractions.push({
      name: 'token',
      source: 'json',
      path: '',
    })
    putRuntime.mockRejectedValueOnce({ response: { status: 409 } })
    expect(await runtime.saveRequest()).toBe(false)
    expect(isCurrentRequestDirty.value).toBe(false)
    expect(runtime.requestDirty.value).toBe(true)
    expect(runtime.conflict.value).toBe(true)
    expect(await runtime.saveRequest()).toBe(true)
    expect(runtime.requestDirty.value).toBe(false)
  })

  it.each(['cancel', 'discard', 'save'] as const)(
    'handles %s for field-only edits',
    async (choice) => {
      const runtime = await load()
      const { httpRuntimeNavigation } = await import('../runtimeNavigation')
      isCurrentRequestDirty.value = true
      const pending = httpRuntimeNavigation.confirmLeave()
      await Promise.resolve()
      expect(runtime.leaveDialogOpen.value).toBe(true)
      await runtime.resolveNavigation(choice)
      expect(await pending).toBe(choice !== 'cancel')
      expect(runtime.requestDirty.value).toBe(choice === 'cancel')
      expect(putRuntime).not.toHaveBeenCalled()
    },
  )

  it('starts clean before the selected request is restored on reload', async () => {
    currentRequest.value = null
    const runtime = await load()
    const { httpRuntimeNavigation } = await import('../runtimeNavigation')

    expect(runtime.dirty.value).toBe(false)
    expect(await httpRuntimeNavigation.confirmLeave()).toBe(true)
    expect(runtime.leaveDialogOpen.value).toBe(false)

    currentRequest.value = request()
    expect(runtime.dirty.value).toBe(false)
    expect(await httpRuntimeNavigation.confirmLeave()).toBe(true)
    expect(runtime.leaveDialogOpen.value).toBe(false)
    expect(putRuntime).not.toHaveBeenCalled()
  })

  it('tracks dirty groups and focuses the first invalid rule across tabs', async () => {
    const runtime = await load()
    runtime.draft.value.extractions.push({
      name: '',
      source: 'json',
      path: '',
    })
    expect(runtime.groupDirty.value).toEqual({
      extractions: true,
      assertions: false,
    })
    expect(runtime.groupInvalid.value.extractions).toBe(true)
    expect(await runtime.saveRuntime()).toBe(false)
    expect(runtime.focusTarget.value).toEqual({
      group: 'extractions',
      index: 0,
      field: 'name',
    })
  })

  it.each(['cancel', 'discard', 'save'] as const)(
    'handles %s before leaving a dirty request',
    async (choice) => {
      const runtime = await load()
      const { httpRuntimeNavigation } = await import('../runtimeNavigation')
      runtime.draft.value.assertions.push({
        name: 'status',
        source: 'status',
        operator: 'eq',
        expected: 200,
      })
      const pending = httpRuntimeNavigation.confirmLeave()
      await Promise.resolve()
      const repeated = httpRuntimeNavigation.confirmLeave()
      await Promise.resolve()
      expect(runtime.leaveDialogOpen.value).toBe(true)
      await runtime.resolveNavigation(choice)
      expect(await pending).toBe(choice !== 'cancel')
      expect(await repeated).toBe(choice !== 'cancel')
      expect(runtime.dirty.value).toBe(choice === 'cancel')
      expect(putRuntime).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
    },
  )

  it('cancels navigation on invalid rules or a save conflict, preserving edits', async () => {
    const runtime = await load()
    const { httpRuntimeNavigation } = await import('../runtimeNavigation')
    runtime.draft.value.assertions.push({
      name: '',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    const invalid = httpRuntimeNavigation.confirmLeave()
    await Promise.resolve()
    await runtime.resolveNavigation('save')
    expect(await invalid).toBe(false)
    expect(runtime.dirty.value).toBe(true)
    expect(runtime.focusTarget.value?.group).toBe('assertions')
    runtime.draft.value.assertions[0]!.name = 'Status'
    putRuntime.mockRejectedValueOnce({ response: { status: 409 } })
    const conflict = httpRuntimeNavigation.confirmLeave()
    await Promise.resolve()
    await runtime.resolveNavigation('save')
    expect(await conflict).toBe(false)
    expect(runtime.conflict.value).toBe(true)
    expect(runtime.dirty.value).toBe(true)
  })

  it('invalidates a pending leave decision when the request owner is reset', async () => {
    const runtime = await load()
    const { httpRuntimeNavigation } = await import('../runtimeNavigation')
    runtime.draft.value.extractions.push({
      name: 'token',
      source: 'json',
      path: '',
    })
    const pending = httpRuntimeNavigation.confirmLeave()
    await Promise.resolve()
    currentRequest.value = null
    expect(await pending).toBe(false)
    expect(runtime.leaveDialogOpen.value).toBe(false)
  })
  it('reveals untouched errors on save without persisting invalid data', async () => {
    const runtime = await load()
    runtime.draft.value.extractions.push({
      name: '',
      source: 'json',
      path: 'bad',
    })
    runtime.draft.value.assertions.push({
      name: '',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    runtime.setExpected(0, 'invalid')
    expect(runtime.fieldError('extractions', 0, 'name')).toBeUndefined()
    expect(await runtime.saveRuntime()).toBe(false)
    expect(runtime.fieldError('extractions', 0, 'name')).toBe('required')
    expect(runtime.fieldError('extractions', 0, 'path')).toBe('pointer')
    expect(runtime.fieldError('assertions', 0, 'name')).toBe('required')
    expect(runtime.fieldError('assertions', 0, 'expected')).toBe(
      'expectedValue',
    )
    expect(putRuntime).not.toHaveBeenCalled()
    runtime.draft.value.extractions[0]!.name = 'demo'
    runtime.draft.value.extractions[0]!.path = '/args/demo'
    runtime.draft.value.assertions[0]!.name = 'Status OK'
    runtime.setExpected(0, '200')
    expect(await runtime.saveRuntime()).toBe(true)
    expect(putRuntime).toHaveBeenCalledTimes(1)
  })

  it('validates unchanged data without an unnecessary write', async () => {
    const runtime = await load()
    expect(await runtime.saveRuntime()).toBe(true)
    expect(putRuntime).not.toHaveBeenCalled()
  })

  it('shows a field error only after blur and clears it while correcting', async () => {
    currentRequest.value = request()
    const runtime = await load()
    runtime.draft.value.extractions.push({
      name: '',
      source: 'json',
      path: '',
    })
    expect(runtime.valid.value).toBe(false)
    expect(runtime.fieldError('extractions', 0, 'name')).toBeUndefined()
    runtime.touchField('extractions', 0, 'name')
    expect(runtime.fieldError('extractions', 0, 'name')).toBe('required')
    runtime.draft.value.extractions[0]!.name = 'demo'
    expect(runtime.fieldError('extractions', 0, 'name')).toBeUndefined()
  })

  it('keeps touched fields attached to their rule when rows are removed', async () => {
    currentRequest.value = request()
    const runtime = await load()
    runtime.draft.value.extractions.push(
      { name: 'first', source: 'json', path: '' },
      { name: '', source: 'json', path: '' },
    )
    runtime.touchField('extractions', 1, 'name')
    runtime.removeExtraction(0)
    expect(runtime.fieldError('extractions', 0, 'name')).toBe('required')
    runtime.removeExtraction(0)
    runtime.draft.value.extractions.push({
      name: '',
      source: 'json',
      path: '',
    })
    expect(runtime.fieldError('extractions', 0, 'name')).toBeUndefined()
  })

  it('validates raw expected input after blur and ignores it for Exists', async () => {
    currentRequest.value = request()
    const runtime = await load()
    runtime.draft.value.assertions.push({
      name: 'check',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    runtime.setExpected(0, '1e999')
    expect(runtime.valid.value).toBe(false)
    expect(runtime.fieldError('assertions', 0, 'expected')).toBeUndefined()
    runtime.touchField('assertions', 0, 'expected')
    expect(runtime.fieldError('assertions', 0, 'expected')).toBe(
      'expectedValue',
    )
    runtime.draft.value.assertions[0]!.operator = 'exists'
    expect(runtime.fieldError('assertions', 0, 'expected')).toBeUndefined()
    expect(runtime.valid.value).toBe(true)
  })

  it('clears touched state when switching requests', async () => {
    currentRequest.value = request()
    const runtime = await load()
    runtime.draft.value.extractions.push({
      name: '',
      source: 'json',
      path: '',
    })
    runtime.touchField('extractions', 0, 'name')
    currentRequest.value = {
      ...request(),
      id: 2,
      runtime: JSON.parse(JSON.stringify(runtime.draft.value)),
    }
    expect(runtime.fieldError('extractions', 0, 'name')).toBeUndefined()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    isCurrentRequestDirty.value = false
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

  it('validates and saves list operands, and ignores hidden errors for type checks', async () => {
    const runtime = await load()
    runtime.draft.value.assertions.push({
      name: 'list',
      source: 'status',
      operator: 'in',
    })
    runtime.setExpected(0, '[200,')
    expect(await runtime.saveRuntime()).toBe(false)
    expect(putRuntime).not.toHaveBeenCalled()
    runtime.setExpected(0, '[200, 201]')
    expect(await runtime.saveRuntime()).toBe(true)
    expect(putRuntime.mock.calls[0]![1].runtime.assertions[0].expected).toEqual(
      [200, 201],
    )
    runtime.draft.value.assertions[0]!.operator = 'between'
    runtime.setExpected(0, '[299, 200]')
    expect(await runtime.saveRuntime()).toBe(false)
    expect(runtime.fieldError('assertions', 0, 'expected')).toBe(
      'expectedRange',
    )
    runtime.setExpected(0, '[')
    runtime.draft.value.assertions[0]!.operator = 'isNumber'
    expect(runtime.valid.value).toBe(true)
    runtime.draft.value.assertions[0]!.operator = 'in'
    expect(runtime.valid.value).toBe(false)
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
