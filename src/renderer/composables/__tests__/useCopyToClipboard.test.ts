import { beforeEach, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from '../useCopyToClipboard'

const { sonner, writeText } = vi.hoisted(() => ({
  sonner: vi.fn(),
  writeText: vi.fn(),
}))
vi.mock('@/composables', () => ({ useSonner: () => ({ sonner }) }))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
})

it('does not report success until the clipboard write finishes', async () => {
  let finish!: () => void
  writeText.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  const pending = useCopyToClipboard()('hello')
  expect(sonner).not.toHaveBeenCalled()
  finish()
  expect(await pending).toBe(true)
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'clipboard', type: 'success' }),
  )
})

it('reports a rejected clipboard write without an unhandled rejection or success', async () => {
  writeText.mockRejectedValueOnce(new Error('Permission denied'))
  expect(await useCopyToClipboard()('hello')).toBe(false)
  expect(sonner).toHaveBeenCalledTimes(1)
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  )
})

it('reports an unavailable clipboard API as an error', async () => {
  vi.stubGlobal('navigator', {})
  expect(await useCopyToClipboard()('hello')).toBe(false)
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  )
})
