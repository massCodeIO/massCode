import type { DockBadgeSource } from '../../store/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDockBadgeController } from '../index'

vi.mock('electron', () => ({
  app: {
    isReady: vi.fn(() => true),
    setBadgeCount: vi.fn(),
  },
}))

vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: vi.fn(() => 'none'),
    },
  },
}))

vi.mock('../../storage/providers/markdown/notes/runtime/constants', () => ({
  peekNotesRuntimeCache: vi.fn(() => null),
}))

vi.mock('../../storage/providers/markdown/runtime/cache', () => ({
  peekRuntimeCache: vi.fn(() => null),
}))

afterEach(() => {
  vi.useRealTimers()
})

function createContext(source: DockBadgeSource = 'none') {
  const setBadgeCount = vi.fn()
  const peekNotesCache = vi.fn(() => null)
  const peekSnippetsCache = vi.fn(() => null)
  let currentSource = source

  const controller = createDockBadgeController({
    app: { isReady: () => true, setBadgeCount },
    clearTimer: clearTimeout,
    getSource: () => currentSource,
    now: () => new Date(),
    peekNotesCache,
    peekSnippetsCache,
    platform: 'darwin',
    setTimer: setTimeout,
  })

  return {
    controller,
    peekNotesCache,
    peekSnippetsCache,
    setBadgeCount,
    setSource: (value: DockBadgeSource) => {
      currentSource = value
    },
  }
}

describe('dock badge controller', () => {
  it('refreshes immediately from only the selected cache', () => {
    const context = createContext('codeInbox')
    context.peekSnippetsCache.mockReturnValue({
      snippets: [{ folderId: null, isDeleted: 0 }],
    } as any)

    expect(context.controller.refresh()).toBe(1)
    expect(context.setBadgeCount).toHaveBeenCalledWith(1)
    expect(context.peekSnippetsCache).toHaveBeenCalledTimes(1)
    expect(context.peekNotesCache).not.toHaveBeenCalled()
  })

  it('does not touch Electron before readiness or outside macOS', () => {
    const setBadgeCount = vi.fn()
    const base = {
      app: { isReady: () => false, setBadgeCount },
      clearTimer: clearTimeout,
      getSource: () => 'none' as const,
      now: () => new Date(),
      peekNotesCache: () => null,
      peekSnippetsCache: () => null,
      setTimer: setTimeout,
    }

    expect(
      createDockBadgeController({ ...base, platform: 'darwin' }).refresh(),
    ).toBe(0)
    expect(
      createDockBadgeController({ ...base, platform: 'linux' }).refresh(),
    ).toBe(0)
    expect(setBadgeCount).not.toHaveBeenCalled()
  })

  it('debounces scheduled refreshes', () => {
    vi.useFakeTimers()
    const context = createContext('none')

    context.controller.scheduleRefresh()
    context.controller.scheduleRefresh()
    vi.advanceTimersByTime(149)
    expect(context.setBadgeCount).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(context.setBadgeCount).toHaveBeenCalledTimes(1)
  })

  it('refreshes tasks at each next local midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 12, 23, 59, 59, 900))
    const context = createContext('tasksDue')

    context.controller.refresh()
    expect(context.setBadgeCount).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    expect(context.setBadgeCount).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(context.setBadgeCount).toHaveBeenCalledTimes(3)
  })

  it('clears timers and badge during cleanup', () => {
    vi.useFakeTimers()
    const context = createContext('tasksDue')
    context.controller.refresh()
    context.controller.scheduleRefresh()

    context.controller.cleanup()
    vi.runAllTimers()

    expect(context.setBadgeCount.mock.calls).toEqual([[0], [0]])
  })
})
