import type { HttpRunView } from '~/shared/httpRunner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

Object.assign(globalThis, { ref })

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
  vi.doMock('@/electron', () => ({
    ipc: { invoke },
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
    result.resolve({ ...prepared, state: 'cancelled' })
    await starting
    status.resolve({ ...prepared, state: 'running' })
    await vi.advanceTimersByTimeAsync(200)
    expect(runner.view.value?.state).toBe('running')
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
