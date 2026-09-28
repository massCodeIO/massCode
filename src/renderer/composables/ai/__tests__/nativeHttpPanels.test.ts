import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  ui: {
    dockTab: { value: 'console' },
    dockOpen: { value: false },
    cookiesOpen: { value: false },
    environmentsOpen: { value: false },
  },
  panels: { inspectorOpen: { value: false }, bottomOpen: { value: false } },
  aiOpen: vi.fn(),
  bridge: vi.fn(async () => ({ status: 'unavailable' })),
}))
vi.mock('@/composables/spaces/http/useHttpUi', () => ({
  useHttpUi: () => mock.ui,
}))
vi.mock('@/composables/spaces/http/useHttpPanels', () => ({
  useHttpPanels: () => mock.panels,
}))
vi.mock('../useAi', () => ({ useAi: () => ({ setOpen: mock.aiOpen }) }))
vi.mock('../nativeBridges', () => ({ runNativeBridge: mock.bridge }))
const { setNativeHttpPanel } = await import('../nativeHttpPanels')
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('nextTick', async () => {})
  mock.panels.bottomOpen.value = false
  mock.ui.dockOpen.value = false
})
const target = { space: 'http' as const, id: 1 }
it('waits for a mounted bottom panel and preserves unavailable native response outcomes', async () => {
  expect(
    await setNativeHttpPanel(
      { action: 'httpPanel', target, panel: 'responseTests', visible: true },
      () => true,
    ),
  ).toEqual({ status: 'unavailable' })
  expect(mock.panels.bottomOpen.value).toBe(true)
  expect(mock.bridge).toHaveBeenCalledOnce()
})
it('does not dispatch into a new selection after the panel mounts', async () => {
  let current = true
  vi.stubGlobal('nextTick', async () => {
    current = false
  })
  expect(
    await setNativeHttpPanel(
      { action: 'httpPanel', target, panel: 'history', visible: true },
      () => current,
    ),
  ).toEqual({ status: 'stale' })
  expect(mock.bridge).not.toHaveBeenCalled()
})
it('opens and closes the requested dock without changing other controls', async () => {
  await setNativeHttpPanel(
    { action: 'httpPanel', target, panel: 'terminal', visible: true },
    () => true,
  )
  expect(mock.ui.dockTab.value).toBe('terminal')
  expect(mock.ui.dockOpen.value).toBe(true)
  await setNativeHttpPanel(
    { action: 'httpPanel', target, panel: 'terminal', visible: false },
    () => true,
  )
  expect(mock.ui.dockOpen.value).toBe(false)
  expect(mock.bridge).not.toHaveBeenCalled()
})

it('switches away from the AI tab for both inspector opening and closing', async () => {
  for (const visible of [true, false]) {
    await setNativeHttpPanel(
      { action: 'httpPanel', target, panel: 'inspector', visible },
      () => true,
    )
    expect(mock.aiOpen).toHaveBeenLastCalledWith(false)
    expect(mock.panels.inspectorOpen.value).toBe(visible)
  }
})
