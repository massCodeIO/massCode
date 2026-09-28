import { afterEach, expect, it, vi } from 'vitest'
import { ref, watch } from 'vue'

afterEach(() => vi.unstubAllGlobals())

it('restores the dock size when any consumer hides and reopens it', async () => {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  const { useHttpUi } = await import('../useHttpUi')
  const panel = useHttpUi()
  const assistant = useHttpUi()
  panel.dockOpen.value = true
  panel.dockMaximized.value = true
  expect(assistant.dockMaximized.value).toBe(true)
  assistant.dockOpen.value = false
  expect(panel.dockMaximized.value).toBe(false)
  assistant.dockOpen.value = true
  expect(panel.dockMaximized.value).toBe(false)
  panel.dockOpen.value = false
})
