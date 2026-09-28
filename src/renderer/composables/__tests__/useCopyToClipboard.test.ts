import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from '../useCopyToClipboard'

const { sonner, invoke } = vi.hoisted(() => ({
  sonner: vi.fn(),
  invoke: vi.fn(),
}))
vi.mock('@/composables', () => ({ useSonner: () => ({ sonner }) }))
vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  ipc: { invoke },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('does not report success until the clipboard write finishes', async () => {
  let finish!: () => void
  invoke.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  const pending = useCopyToClipboard()('hello')
  expect(invoke).toHaveBeenCalledWith('system:clipboard-write-text', 'hello')
  expect(sonner).not.toHaveBeenCalled()
  finish()
  expect(await pending).toBe(true)
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'clipboard', type: 'success' }),
  )
})

it('reports a rejected clipboard write without an unhandled rejection or success', async () => {
  invoke.mockRejectedValueOnce(new Error('Permission denied'))
  expect(await useCopyToClipboard()('hello')).toBe(false)
  expect(sonner).toHaveBeenCalledTimes(1)
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  )
})

it('copies through main when the browser clipboard API is unavailable', async () => {
  invoke.mockResolvedValueOnce(undefined)
  expect(await useCopyToClipboard()('hello')).toBe(true)
  expect(invoke).toHaveBeenCalledWith('system:clipboard-write-text', 'hello')
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'success' }),
  )
})
