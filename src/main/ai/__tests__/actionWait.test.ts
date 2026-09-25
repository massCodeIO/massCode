import { afterEach, expect, it, vi } from 'vitest'
import { createActionWait } from '../actionWait'

afterEach(() => vi.useRealTimers())
it('pauses provider budget while awaiting confirmation and resumes the remaining budget', async () => {
  vi.useFakeTimers()
  const wait = createActionWait(new AbortController().signal, 1000)
  await vi.advanceTimersByTimeAsync(400)
  const result = wait.wait('action')
  await vi.advanceTimersByTimeAsync(60_000)
  expect(wait.signal.aborted).toBe(false)
  wait.settle('other', {})
  expect(wait.owns('action')).toBe(true)
  wait.settle('action', { status: 'done' })
  await expect(result).resolves.toEqual({ status: 'done' })
  wait.settle('action', { status: 'failed' })
  await vi.advanceTimersByTimeAsync(599)
  expect(wait.signal.aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(wait.signal.aborted).toBe(true)
  wait.dispose()
})
it('aborts a suspended tool and removes its timer', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const wait = createActionWait(controller.signal, 1000)
  const pending = wait.wait('action')
  const rejected = expect(pending).rejects.toThrow()
  controller.abort()
  await rejected
  expect(wait.owns('action')).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  wait.dispose()
})

it('does not start an unbounded wait after the provider deadline has expired', async () => {
  vi.useFakeTimers()
  const wait = createActionWait(new AbortController().signal, 100)
  await vi.advanceTimersByTimeAsync(100)
  expect(() => wait.wait('late')).toThrow()
  expect(wait.owns('late')).toBe(false)
  wait.dispose()
})
