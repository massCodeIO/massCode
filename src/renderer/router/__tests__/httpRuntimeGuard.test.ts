import { describe, expect, it, vi } from 'vitest'

const beforeEachRoute = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  createRouter: () => ({ beforeEach: beforeEachRoute }),
  createWebHashHistory: vi.fn(),
}))

describe('hTTP runtime route guard', () => {
  it('confirms leaving HTTP but ignores navigation within it and unrelated spaces', async () => {
    const { RouterName } = await import('../index')
    const { httpRuntimeNavigation } = await import(
      '@/composables/spaces/http/runtimeNavigation'
    )
    const confirmLeave = vi.fn(async () => false)
    httpRuntimeNavigation.confirmLeave = confirmLeave
    const guard = beforeEachRoute.mock.calls[0]![0]
    expect(
      await guard({ name: RouterName.main }, { name: RouterName.httpSpace }),
    ).toBe(false)
    expect(
      guard({ name: RouterName.httpSpace }, { name: RouterName.httpSpace }),
    ).toBe(true)
    expect(
      guard({ name: RouterName.preferences }, { name: RouterName.main }),
    ).toBe(true)
    expect(confirmLeave).toHaveBeenCalledTimes(1)
  })
})
