import type { HttpRunView } from '~/shared/httpRunner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

Object.assign(globalThis, { computed, ref })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function setup() {
  vi.resetModules()
  const prepared: HttpRunView = {
    runId: 'test-run',
    folderId: 1,
    folderName: 'API',
    environmentName: null,
    state: 'ready',
    steps: [1, 2].map(requestId => ({
      requestId,
      name: `Step ${requestId}`,
      folderPath: 'API',
      method: 'GET',
      state: 'pending',
    })),
  }
  const result = deferred<HttpRunView>()
  const status = deferred<HttpRunView>()
  const httpState: {
    activePanel: 'request' | 'folder' | 'environments' | 'runner'
  } = { activePanel: 'folder' }
  vi.doMock('../useHttpApp', () => ({ useHttpApp: () => ({ httpState }) }))
  const confirmLeave = vi.fn(async () => true)
  const sonner = vi.fn()
  const invoke = vi.fn(async (channel: string, _payload: unknown) => {
    if (channel === 'spaces:http:run-prepare')
      return structuredClone(prepared)
    if (channel === 'spaces:http:run-start')
      return result.promise
    if (channel === 'spaces:http:run-status')
      return status.promise
    return null
  })
  vi.doMock('@/router', () => ({
    router: { push: vi.fn(async () => {}) },
    RouterName: { httpSpace: 'http' },
  }))
  vi.doMock('@/electron', () => ({
    ipc: { invoke },
    store: { preferences: { get: () => '/vault' } },
    i18n: { t: (key: string) => key },
  }))
  vi.doMock('@/composables/useSonner', () => ({
    useSonner: () => ({ sonner }),
  }))
  vi.doMock('../runtimeNavigation', () => ({
    httpRuntimeNavigation: { confirmLeave, transitionToken: 0 },
  }))
  vi.doMock('../useHttpSettings', () => ({
    useHttpSettings: () => ({
      settings: { skipCertificateVerification: false },
    }),
  }))
  const runner = (await import('../useHttpRunner')).useHttpRunner()
  return {
    httpState,
    runner,
    prepared,
    result,
    status,
    confirmLeave,
    invoke,
    sonner,
  }
}

afterEach(() => vi.useRealTimers())

describe('hTTP folder runner UI state', () => {
  it('opens in the right panel and returns to the previous panel on close', async () => {
    const { runner, httpState } = await setup()
    await runner.openRunner(1)
    expect(httpState.activePanel).toBe('runner')
    runner.closeRunner()
    expect(httpState.activePanel).toBe('folder')
  })

  it('honors the unsaved request guard before preparing snapshots', async () => {
    const { runner, confirmLeave, invoke } = await setup()
    confirmLeave.mockResolvedValue(false)
    await runner.openRunner(1)
    expect(invoke).not.toHaveBeenCalled()
    expect(runner.open.value).toBe(false)
    expect(runner.preparing.value).toBe(false)
  })

  it('does not prepare after leaving the view during confirmation', async () => {
    const { runner, confirmLeave, invoke } = await setup()
    const confirmation = deferred<boolean>()
    confirmLeave.mockReturnValue(confirmation.promise)
    const opening = runner.openRunner(1)
    runner.closeRunner()
    confirmation.resolve(true)
    await opening
    expect(invoke).not.toHaveBeenCalledWith(
      'spaces:http:run-prepare',
      expect.anything(),
    )
    expect(runner.open.value).toBe(false)
  })

  it('sends run-local order and options and freezes reordering while running', async () => {
    const { runner, prepared, result, invoke } = await setup()
    await runner.openRunner(1)
    runner.reorderSteps([...runner.view.value!.steps].reverse())
    runner.continueOnFailure.value = true
    const starting = runner.startRunner()
    runner.reorderSteps([...runner.view.value!.steps].reverse())
    expect(runner.view.value?.steps.map(step => step.requestId)).toEqual([
      2,
      1,
    ])
    expect(invoke).toHaveBeenCalledWith('spaces:http:run-start', {
      runId: 'test-run',
      requestIds: [2, 1],
      continueOnFailure: true,
      skipCertificateVerification: false,
      transport: {},
    })
    result.resolve({ ...prepared, state: 'passed' })
    await starting
    expect(runner.running.value).toBe(false)
    expect(runner.view.value?.state).toBe('passed')
  })

  it('cancels only once and ignores late status and results after closing', async () => {
    vi.useFakeTimers()
    const { runner, prepared, result, status, invoke } = await setup()
    await runner.openRunner(1)
    const starting = runner.startRunner()
    await vi.advanceTimersByTimeAsync(200)
    await runner.cancelRunner()
    await runner.cancelRunner()
    expect(
      invoke.mock.calls.filter(
        ([channel]) => channel === 'spaces:http:run-cancel',
      ),
    ).toHaveLength(1)
    runner.closeRunner()
    expect(invoke).toHaveBeenCalledWith('spaces:http:run-dispose', null)
    result.resolve({
      ...prepared,
      state: 'cancelled',
      continueOnFailure: true,
    })
    await starting
    status.resolve({ ...prepared, state: 'running', continueOnFailure: true })
    await vi.advanceTimersByTimeAsync(200)
    expect(runner.view.value?.state).toBe('running')
    expect(runner.continueOnFailure.value).toBe(false)
    runner.clearRunnerView()
    expect(runner.view.value).toBeNull()
    expect(runner.open.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses drag order for execution and ignores late drops after starting or closing', async () => {
    const { runner, prepared, result, invoke } = await setup()
    await runner.openRunner(1)
    runner.reorderSteps([...runner.view.value!.steps].reverse())
    const starting = runner.startRunner()
    runner.reorderSteps(prepared.steps)
    expect(runner.view.value?.steps.map(step => step.requestId)).toEqual([
      2,
      1,
    ])
    expect(invoke).toHaveBeenCalledWith(
      'spaces:http:run-start',
      expect.objectContaining({ requestIds: [2, 1] }),
    )
    result.resolve({ ...prepared, state: 'passed' })
    await starting
    runner.reorderSteps([...prepared.steps].reverse())
    expect(runner.view.value?.steps.map(step => step.requestId)).toEqual([
      1,
      2,
    ])
    runner.closeRunner()
    runner.reorderSteps(prepared.steps)
    runner.clearRunnerView()
    expect(runner.view.value).toBeNull()
  })

  it('keeps the displayed content until the close animation finishes without allowing actions', async () => {
    const { runner, invoke } = await setup()
    await runner.openRunner(1)
    const displayed = runner.view.value
    runner.closeRunner()
    expect(runner.open.value).toBe(false)
    expect(runner.view.value).toBe(displayed)
    expect(runner.folderId.value).toBe(1)
    expect(invoke).toHaveBeenCalledWith('spaces:http:run-dispose', null)
    runner.reorderSteps([...displayed!.steps].reverse())
    await runner.startRunner()
    expect(runner.view.value?.steps.map(step => step.requestId)).toEqual([
      1,
      2,
    ])
    expect(invoke).not.toHaveBeenCalledWith(
      'spaces:http:run-start',
      expect.anything(),
    )
    runner.clearRunnerView()
    expect(runner.view.value).toBeNull()
    expect(runner.folderId.value).toBeNull()
  })

  it('does not clear a reopened dialog when the old leave callback arrives', async () => {
    const { runner } = await setup()
    await runner.openRunner(1)
    runner.closeRunner()
    await runner.openRunner(2)
    runner.clearRunnerView()
    expect(runner.open.value).toBe(true)
    expect(runner.view.value?.folderName).toBe('API')
    expect(runner.folderId.value).toBe(2)
  })
})

it('adopts an existing run and polls without preparing or starting a second execution', async () => {
  vi.useFakeTimers()
  const { runner, status, prepared, invoke, httpState } = await setup()
  const adopting = runner.adoptRunner('test-run', '/vault')
  status.resolve({ ...prepared, state: 'running' })
  await adopting
  expect(runner.folderId.value).toBe(prepared.folderId)
  expect(runner.view.value?.runId).toBe('test-run')
  expect(httpState.activePanel).toBe('runner')
  expect(runner.running.value).toBe(true)
  expect(
    invoke.mock.calls.every(
      ([channel]) => channel === 'spaces:http:run-status',
    ),
  ).toBe(true)
  runner.closeRunner()
  const calls = invoke.mock.calls.length
  await vi.advanceTimersByTimeAsync(1000)
  expect(invoke).toHaveBeenCalledTimes(calls)
})

it('reopens a completed receipt after leaving HTTP without reading or disposing a runtime', async () => {
  const { runner, prepared, invoke, httpState } = await setup()
  const snapshot: HttpRunView = {
    ...prepared,
    state: 'failed',
    steps: [{ ...prepared.steps[0], state: 'failed' }],
  }
  await runner.adoptRunner(snapshot.runId, '/vault', snapshot)
  runner.closeRunner()
  runner.clearRunnerView()
  await runner.adoptRunner(snapshot.runId, '/vault', snapshot)
  expect(httpState.activePanel).toBe('runner')
  expect(runner.view.value).toEqual(snapshot)
  expect(runner.running.value).toBe(false)
  expect(invoke).not.toHaveBeenCalled()
  runner.closeRunner()
  expect(invoke).not.toHaveBeenCalled()
})

it('keeps an adopted live run visible and polling when an older receipt is opened', async () => {
  vi.useFakeTimers()
  const { runner, prepared, status, invoke, httpState } = await setup()
  const first: HttpRunView = {
    ...prepared,
    runId: 'first',
    state: 'passed',
    continueOnFailure: true,
  }
  const adopting = runner.adoptRunner('second', '/vault')
  status.resolve({ ...prepared, runId: 'second', state: 'running' })
  await adopting
  await runner.adoptRunner(first.runId, '/vault', first)
  expect(httpState.activePanel).toBe('runner')
  expect(runner.view.value?.runId).toBe('second')
  expect(runner.running.value).toBe(true)
  expect(runner.continueOnFailure.value).toBe(false)
  const calls = invoke.mock.calls.length
  await vi.advanceTimersByTimeAsync(200)
  expect(invoke.mock.calls.length).toBeGreaterThan(calls)
  await runner.cancelRunner()
  expect(invoke).toHaveBeenCalledWith('spaces:http:run-cancel', 'second')
  invoke.mockResolvedValueOnce({
    ...prepared,
    runId: 'second',
    state: 'cancelled',
  })
  await vi.advanceTimersByTimeAsync(200)
  expect(runner.running.value).toBe(false)
  expect(runner.view.value?.state).toBe('cancelled')
  await runner.adoptRunner(first.runId, '/vault', first)
  expect(runner.view.value?.runId).toBe('first')
  expect(runner.continueOnFailure.value).toBe(true)
  runner.closeRunner()
  expect(
    invoke.mock.calls.some(
      ([channel]) => channel === 'spaces:http:run-dispose',
    ),
  ).toBe(false)
})

it('preserves manual run progress, Stop and its final result when opening a historical receipt', async () => {
  vi.useFakeTimers()
  const { runner, prepared, status, result, invoke } = await setup()
  await runner.openRunner(1)
  const starting = runner.startRunner()
  const first: HttpRunView = {
    ...prepared,
    runId: 'first',
    state: 'passed',
    continueOnFailure: true,
  }
  await runner.adoptRunner(first.runId, '/vault', first)
  expect(runner.view.value?.runId).toBe(prepared.runId)
  expect(runner.running.value).toBe(true)
  status.resolve({
    ...prepared,
    state: 'running',
    steps: [{ ...prepared.steps[0], state: 'passed' }],
  })
  await vi.advanceTimersByTimeAsync(200)
  expect(runner.view.value?.steps[0].state).toBe('passed')
  await runner.cancelRunner()
  expect(invoke).toHaveBeenCalledWith('spaces:http:run-cancel', prepared.runId)
  result.resolve({ ...prepared, state: 'cancelled' })
  await starting
  expect(runner.view.value?.runId).toBe(prepared.runId)
  expect(runner.view.value?.state).toBe('cancelled')
  expect(runner.running.value).toBe(false)
  await runner.adoptRunner(first.runId, '/vault', first)
  expect(runner.view.value?.runId).toBe('first')
  expect(runner.continueOnFailure.value).toBe(true)
  runner.closeRunner()
})

it.each([false, true])(
  'shows actual adopted continueOnFailure=%s without changing the manual preference',
  async (option) => {
    vi.useFakeTimers()
    const { runner, prepared, status, invoke } = await setup()
    runner.continueOnFailure.value = !option
    const adopting = runner.adoptRunner(prepared.runId, '/vault')
    status.resolve({
      ...prepared,
      state: 'running',
      continueOnFailure: option,
    })
    await adopting
    expect(runner.continueOnFailure.value).toBe(option)
    invoke.mockResolvedValueOnce({
      ...prepared,
      state: 'failed',
      continueOnFailure: option,
    })
    await vi.advanceTimersByTimeAsync(200)
    expect(runner.continueOnFailure.value).toBe(option)
    expect(runner.running.value).toBe(false)
    await runner.openRunner(1)
    expect(runner.continueOnFailure.value).toBe(!option)
    runner.closeRunner()
  },
)

it('updates an adopted ready run option when its execution starts', async () => {
  vi.useFakeTimers()
  const { runner, prepared, status, invoke } = await setup()
  const adopting = runner.adoptRunner(prepared.runId, '/vault')
  status.resolve(prepared)
  await adopting
  expect(runner.continueOnFailure.value).toBe(false)
  invoke.mockResolvedValueOnce({
    ...prepared,
    state: 'running',
    continueOnFailure: true,
  })
  await vi.advanceTimersByTimeAsync(200)
  expect(runner.continueOnFailure.value).toBe(true)
  runner.closeRunner()
})

it('shows each reopened snapshot option and preserves the next ready run preference', async () => {
  const { runner, prepared } = await setup()
  runner.continueOnFailure.value = true
  for (const option of [false, true, false]) {
    const snapshot: HttpRunView = {
      ...prepared,
      state: 'failed',
      continueOnFailure: option,
    }
    await runner.adoptRunner(snapshot.runId, '/vault', snapshot)
    expect(runner.continueOnFailure.value).toBe(option)
    runner.closeRunner()
    runner.clearRunnerView()
  }
  await runner.openRunner(1)
  expect(runner.continueOnFailure.value).toBe(true)
  runner.closeRunner()
})

it.each(['wrong-run', 'wrong-vault', 'closed'])(
  'ignores %s adopted status options',
  async (reason) => {
    const { runner, prepared, status } = await setup()
    const adopting = runner.adoptRunner(
      prepared.runId,
      reason === 'wrong-vault' ? '/other' : '/vault',
    )
    if (reason === 'closed')
      runner.closeRunner()
    status.resolve({
      ...prepared,
      runId: reason === 'wrong-run' ? 'other' : prepared.runId,
      state: 'running',
      continueOnFailure: true,
    })
    await adopting
    expect(runner.continueOnFailure.value).toBe(false)
    expect(runner.open.value).toBe(false)
  },
)
