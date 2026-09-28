import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { executeOwnedHttpRequest } from '../ownedExecution'

const execute = vi.hoisted(() => vi.fn())
vi.mock('../execute', () => ({ executeHttpRequest: execute }))
it('shares the manual lock and releases listeners/lock on owner navigation and failure', async () => {
  const owner = Object.assign(new EventEmitter(), { id: 1 }) as any
  execute.mockImplementation(
    (_payload, _unused, signal) =>
      new Promise(resolve =>
        signal.addEventListener('abort', () => resolve({ error: 'cancelled' })),
      ),
  )
  const first = executeOwnedHttpRequest(owner, {} as any)
  await expect(executeOwnedHttpRequest(owner, {} as any)).rejects.toThrow(
    'HTTP_REQUEST_RUNNING',
  )
  owner.emit('did-start-navigation', {}, '/other', false, true)
  await first
  expect(owner.listenerCount('destroyed')).toBe(0)
  expect(owner.listenerCount('did-start-navigation')).toBe(0)
  execute.mockRejectedValueOnce(new Error('failed'))
  await expect(executeOwnedHttpRequest(owner, {} as any)).rejects.toThrow(
    'failed',
  )
  execute.mockResolvedValueOnce({ status: 200 })
  await expect(executeOwnedHttpRequest(owner, {} as any)).resolves.toEqual({
    status: 200,
  })
})
