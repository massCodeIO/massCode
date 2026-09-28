import { expect, it, vi } from 'vitest'
import { markRaw } from 'vue'
import { useSonner } from '../useSonner'

const { custom, dismiss } = vi.hoisted(() => ({
  custom: vi.fn(),
  dismiss: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: { custom, dismiss } }))
vi.mock('@/components/ui/sonner/Sonner.vue', () => ({ default: {} }))
Object.assign(globalThis, { markRaw })

it.each([
  ['success', 3000],
  ['warning', 5000],
  ['error', 8000],
  ['default', 5000],
] as const)(
  'uses the %s timeout and an accessible close control',
  (type, duration) => {
    useSonner().sonner({ type, message: 'message' })
    expect(custom).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration,
        componentProps: expect.objectContaining({ closeButton: true }),
      }),
    )
  },
)

it('preserves an explicit timeout and identity for repeated notifications', () => {
  useSonner().sonner({ id: 'copy', duration: 0, closeButton: false })
  expect(custom).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      id: 'copy',
      duration: 0,
      componentProps: expect.objectContaining({ closeButton: false }),
    }),
  )
})

it('keeps existing actionable notifications available until dismissed', () => {
  useSonner().sonner({ action: { label: 'Open', onClick: vi.fn() } })
  expect(custom).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: Infinity }),
  )
})
