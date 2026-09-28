import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref, shallowRef, watch } from 'vue'

const mock = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('@/router', () => ({
  router: { push: mock.push },
  RouterName: { preferencesStorage: 'storage', preferencesAI: 'ai' },
}))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('watch', watch)
})
it('does not treat navigation as a completed profile configuration', async () => {
  const flows = await import('../nativePreferenceFlows')
  flows.registerPreferenceFlow('configureAi', (action, id, current) =>
    flows.waitForPreferenceUser('configureAi', id, current))
  let finished = false
  const result = flows
    .executePreferenceFlow({ action: 'configureAi' }, 'one', () => true)
    .then((value) => {
      finished = true
      return value
    })
  await vi.waitFor(() => expect(flows.preferenceHandoff.value?.id).toBe('one'))
  expect(finished).toBe(false)
  flows.cancelPreferenceHandoff()
  await expect(result).resolves.toEqual({ status: 'cancelled' })
})
it('keeps a saved model-less configuration open and completes after a real second save', async () => {
  const flows = await import('../nativePreferenceFlows')
  const result = flows.waitForPreferenceUser('configureAi', 'one', () => true)
  const first = flows.claimPreferenceHandoff('configureAi')
  expect(flows.claimPreferenceHandoff('configureAi')).toBeUndefined()
  flows.finishPreferenceHandoff(
    first,
    {
      status: 'done',
      persisted: true,
      profile: {
        provider: 'ollama',
        model: '',
        saved: true,
        connectionCheck: 'passed',
      },
    },
    true,
  )
  expect(flows.preferenceHandoff.value?.partial?.persisted).toBe(true)
  const second = flows.claimPreferenceHandoff('configureAi')
  flows.finishPreferenceHandoff(second, {
    status: 'done',
    persisted: true,
    profile: {
      provider: 'ollama',
      model: 'local',
      saved: true,
      connectionCheck: 'passed',
    },
  })
  await expect(result).resolves.toMatchObject({
    status: 'done',
    profile: { model: 'local' },
  })
})
it('waits for in-flight save after cancellation and retains the actual partial result', async () => {
  const flows = await import('../nativePreferenceFlows')
  const current = ref(true)
  let finished = false
  const result = flows
    .waitForPreferenceUser('configureAi', 'one', () => current.value)
    .then((value) => {
      finished = true
      return value
    })
  const id = flows.claimPreferenceHandoff('configureAi')
  current.value = false
  await nextTick()
  expect(finished).toBe(false)
  expect(flows.preferenceHandoff.value?.cancelRequested).toBe(true)
  flows.finishPreferenceHandoff(id, {
    status: 'failed',
    persisted: true,
    profile: {
      provider: 'openai',
      model: 'selected',
      saved: true,
      connectionCheck: 'failed',
    },
  })
  await expect(result).resolves.toMatchObject({
    status: 'cancelled',
    persisted: true,
    profile: { connectionCheck: 'failed' },
  })
})
it('does not start a storage operation when the captured task changes during navigation', async () => {
  const flows = await import('../nativePreferenceFlows')
  let current = true
  mock.push.mockImplementationOnce(async () => {
    current = false
  })
  const run = vi.fn()
  flows.registerPreferenceFlow('storage', run)
  expect(
    await flows.executePreferenceFlow(
      { action: 'storage', command: 'move' },
      'one',
      () => current,
    ),
  ).toEqual({ status: 'stale' })
  expect(run).not.toHaveBeenCalled()
})

it('retains a saved profile when the second configuration attempt fails before saving', async () => {
  const flows = await import('../nativePreferenceFlows')
  const result = flows.waitForPreferenceUser('configureAi', 'one', () => true)
  const first = flows.claimPreferenceHandoff('configureAi')
  const profile = {
    provider: 'ollama',
    model: '',
    saved: true,
    connectionCheck: 'passed' as const,
  }
  flows.finishPreferenceHandoff(
    first,
    { status: 'done', persisted: true, profile },
    true,
  )
  const second = flows.claimPreferenceHandoff('configureAi')
  flows.finishPreferenceHandoff(second, { status: 'failed', persisted: false })
  await expect(result).resolves.toMatchObject({
    status: 'failed',
    persisted: true,
    profile,
  })
})
