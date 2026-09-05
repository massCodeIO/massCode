import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureLifecycle, requestLifecycleAction } from '../lifecycle'
import { isQuitting, setQuitting } from '../quitState'

const context = vi.hoisted(() => ({
  listeners: new Map<string, (...args: any[]) => void>(),
  quit: vi.fn(),
}))
vi.mock('electron', () => ({
  app: { quit: context.quit },
  ipcMain: {
    on: (channel: string, callback: (...args: any[]) => void) =>
      context.listeners.set(channel, callback),
    removeListener: (channel: string) => context.listeners.delete(channel),
  },
}))

const contents = { isDestroyed: () => false, mainFrame: {}, send: vi.fn() }
const window = {
  isDestroyed: () => false,
  webContents: contents,
  show: vi.fn(),
}
const cleanup = vi.fn(() => true)
function reply(allowed: boolean, sender = contents) {
  const payload = contents.send.mock.lastCall![1]
  context.listeners.get('system:confirm-leave-result')?.(
    { sender, senderFrame: contents.mainFrame },
    { ...payload, allowed },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  setQuitting(false)
  configureLifecycle(() => window as never, cleanup)
})
afterEach(() => vi.useRealTimers())

describe('renderer confirmation before destructive lifecycle actions', () => {
  it.each(['quit', 'restart', 'update', 'reload'])(
    'waits for approval before %s',
    async (kind) => {
      const action = vi.fn(() => {
        expect(isQuitting()).toBe(kind !== 'reload')
      })
      const pending = requestLifecycleAction(action, kind !== 'reload')
      expect(cleanup).not.toHaveBeenCalled()
      expect(action).not.toHaveBeenCalled()
      reply(true)
      expect(await pending).toBe(true)
      expect(action).toHaveBeenCalledOnce()
      expect(cleanup).toHaveBeenCalledTimes(kind === 'reload' ? 0 : 1)
    },
  )

  it.each(['cancel', 'invalid', 'failed save', 'busy save'])(
    'preserves window and watchers on %s',
    async () => {
      const action = vi.fn()
      const pending = requestLifecycleAction(action)
      reply(false)
      expect(await pending).toBe(false)
      expect(cleanup).not.toHaveBeenCalled()
      expect(action).not.toHaveBeenCalled()
      expect(isQuitting()).toBe(false)
    },
  )

  it('coalesces concurrent quit/restart/update and executes only the first intent', async () => {
    const restart = vi.fn()
    const update = vi.fn()
    const first = requestLifecycleAction()
    expect(requestLifecycleAction(restart)).toBe(first)
    expect(requestLifecycleAction(update)).toBe(first)
    expect(contents.send).toHaveBeenCalledOnce()
    reply(true)
    await first
    expect(context.quit).toHaveBeenCalledOnce()
    expect(restart).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not relaunch or install if flushing persisted state fails', async () => {
    cleanup.mockReturnValueOnce(false)
    const action = vi.fn()
    const pending = requestLifecycleAction(action)
    reply(true)
    expect(await pending).toBe(false)
    expect(action).not.toHaveBeenCalled()
    expect(isQuitting()).toBe(false)
  })

  it('ignores foreign renderer replies and expires closed, allowing a retry', async () => {
    const pending = requestLifecycleAction()
    reply(true, { ...contents })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(await pending).toBe(false)
    expect(context.quit).not.toHaveBeenCalled()
    expect(cleanup).not.toHaveBeenCalled()
    expect(context.listeners.size).toBe(0)
    const retry = requestLifecycleAction()
    reply(true)
    expect(await retry).toBe(true)
  })
})
