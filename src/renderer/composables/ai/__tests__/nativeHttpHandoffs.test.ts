import { beforeEach, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, { nextTick, ref, shallowRef, watch })
const mock = vi.hoisted(() => ({
  get: vi.fn(),
  picker: vi.fn(),
  ui: { environmentsOpen: { value: false } },
  environments: { value: [{ id: 3, variables: {}, secretKeys: ['TOKEN'] }] },
}))
vi.mock('@/composables/spaces/http/chooseHttpFile', () => ({
  chooseHttpFile: mock.picker,
}))
vi.mock('@/composables/spaces/http/useHttpEnvironments', () => ({
  useHttpEnvironments: () => ({
    getHttpEnvironments: mock.get,
    environments: mock.environments,
  }),
}))
vi.mock('@/composables/spaces/http/useHttpRequests', () => ({
  useHttpRequests: () => ({}),
}))
vi.mock('@/composables/spaces/http/useHttpUi', () => ({
  useHttpUi: () => mock.ui,
}))
const { executeHttpHandoff, httpSecretHandoff, closeHttpSecretHandoff }
  = await import('../nativeHttpHandoffs')
const action = {
  action: 'enterHttpSecret' as const,
  target: { space: 'http' as const, id: 7 },
  environmentId: 3,
  key: 'TOKEN',
}
beforeEach(() => {
  mock.get.mockResolvedValue(true)
  httpSecretHandoff.value = undefined
})
it('waits for actual local completion instead of reporting the dialog as saved', async () => {
  const settled = vi.fn()
  const pending = executeHttpHandoff(action, () => true).then(settled)
  await nextTick()
  expect(mock.ui.environmentsOpen.value).toBe(true)
  expect(settled).not.toHaveBeenCalled()
  httpSecretHandoff.value!.finish({
    status: 'done',
    persisted: true,
    secret: { environmentId: 3, key: 'TOKEN', present: true, saved: true },
  })
  await pending
  expect(settled).toHaveBeenCalledWith({
    status: 'done',
    persisted: true,
    secret: { environmentId: 3, key: 'TOKEN', present: true, saved: true },
  })
})
it('settles cancellation and stale task changes and refuses unavailable environments', async () => {
  const current = ref(true)
  const pending = executeHttpHandoff(action, () => current.value)
  await nextTick()
  current.value = false
  await expect(pending).resolves.toEqual({ status: 'stale' })
  const cancelled = executeHttpHandoff(action, () => true)
  await nextTick()
  httpSecretHandoff.value!.finish({ status: 'cancelled' })
  await expect(cancelled).resolves.toEqual({ status: 'cancelled' })
  await expect(
    executeHttpHandoff({ ...action, environmentId: 99 }, () => true),
  ).resolves.toEqual({ status: 'unavailable' })
})

it.each([true, false])(
  'waits for an in-flight secret save on close and reports its actual outcome (%s)',
  async (saved) => {
    const settled = vi.fn()
    const pending = executeHttpHandoff(action, () => true).then(settled)
    await nextTick()
    const handoff = httpSecretHandoff.value!
    let complete!: () => void
    const flushing = new Promise<void>((resolve) => {
      complete = () => {
        handoff.finish({
          status: saved ? 'done' : 'failed',
          persisted: saved,
          secret: { environmentId: 3, key: 'TOKEN', present: saved, saved },
        })
        resolve()
      }
    })
    const closing = closeHttpSecretHandoff(() => flushing)
    const unmounting = closeHttpSecretHandoff(() => flushing)
    await nextTick()
    expect(settled).not.toHaveBeenCalled()
    expect(httpSecretHandoff.value).toBe(handoff)
    complete()
    await Promise.all([pending, closing, unmounting])
    expect(settled).toHaveBeenCalledOnce()
    expect(settled).toHaveBeenCalledWith(
      expect.objectContaining({
        status: saved ? 'done' : 'failed',
        persisted: saved,
      }),
    )
  },
)
it('cancels an untouched secret entry after an empty close flush', async () => {
  const pending = executeHttpHandoff(action, () => true)
  await nextTick()
  await closeHttpSecretHandoff(async () => {})
  await expect(pending).resolves.toEqual({ status: 'cancelled' })
})
