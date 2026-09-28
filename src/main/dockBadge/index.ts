/* eslint-disable node/prefer-global/process */
import type { NotesRuntimeCache } from '../storage/providers/markdown/notes/runtime/types'
import type { MarkdownRuntimeCache } from '../storage/providers/markdown/runtime/types'
import type { DockBadgeSource } from '../store/types'
import { app } from 'electron'
import { peekNotesRuntimeCache } from '../storage/providers/markdown/notes/runtime/constants'
import { peekRuntimeCache } from '../storage/providers/markdown/runtime/cache'
import { store } from '../store'
import { countDockBadge, getLocalDateOnly } from './counts'

const REFRESH_DELAY_MS = 150

interface DockBadgeControllerDependencies {
  app: Pick<typeof app, 'isReady' | 'setBadgeCount'>
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void
  getSource: () => DockBadgeSource
  now: () => Date
  peekNotesCache: () => NotesRuntimeCache | null
  peekSnippetsCache: () => MarkdownRuntimeCache | null
  platform: NodeJS.Platform
  setTimer: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout>
}

export interface DockBadgeController {
  cleanup: () => void
  refresh: () => DockBadgeRefreshResult
  scheduleRefresh: () => void
}

export interface DockBadgeRefreshResult {
  applied: boolean
  count: number
}

export function createDockBadgeController(
  dependencies: DockBadgeControllerDependencies,
): DockBadgeController {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let midnightTimer: ReturnType<typeof setTimeout> | null = null

  function clearRefreshTimer(): void {
    if (refreshTimer) {
      dependencies.clearTimer(refreshTimer)
      refreshTimer = null
    }
  }

  function clearMidnightTimer(): void {
    if (midnightTimer) {
      dependencies.clearTimer(midnightTimer)
      midnightTimer = null
    }
  }

  function scheduleMidnightRefresh(source: DockBadgeSource): void {
    clearMidnightTimer()
    if (source !== 'tasksDue') {
      return
    }

    const now = dependencies.now()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)
    midnightTimer = dependencies.setTimer(() => {
      midnightTimer = null
      refresh()
    }, nextMidnight.getTime() - now.getTime())
  }

  function refresh(): DockBadgeRefreshResult {
    clearRefreshTimer()
    if (dependencies.platform !== 'darwin' || !dependencies.app.isReady()) {
      clearMidnightTimer()
      return { applied: false, count: 0 }
    }

    const source = dependencies.getSource()
    const snippets
      = source === 'codeInbox'
        ? (dependencies.peekSnippetsCache()?.snippets ?? [])
        : []
    const notes
      = source === 'notesInbox' || source === 'tasksDue'
        ? (dependencies.peekNotesCache()?.notes ?? [])
        : []
    const count = countDockBadge(
      source,
      { notes, snippets },
      getLocalDateOnly(dependencies.now()),
    )

    const applied = dependencies.app.setBadgeCount(count)
    scheduleMidnightRefresh(source)

    return { applied, count }
  }

  function scheduleRefresh(): void {
    if (dependencies.platform !== 'darwin') {
      return
    }

    clearRefreshTimer()
    refreshTimer = dependencies.setTimer(() => {
      refreshTimer = null
      refresh()
    }, REFRESH_DELAY_MS)
  }

  function cleanup(): void {
    clearRefreshTimer()
    clearMidnightTimer()
    if (dependencies.platform === 'darwin' && dependencies.app.isReady()) {
      dependencies.app.setBadgeCount(0)
    }
  }

  return { cleanup, refresh, scheduleRefresh }
}

const controller = createDockBadgeController({
  app,
  clearTimer: clearTimeout,
  getSource: () =>
    store.preferences.get('appearance.dockBadgeSource') as DockBadgeSource,
  now: () => new Date(),
  peekNotesCache: peekNotesRuntimeCache,
  peekSnippetsCache: peekRuntimeCache,
  platform: process.platform,
  setTimer: setTimeout,
})

export const cleanupDockBadge = controller.cleanup
export const refreshDockBadge = controller.refresh
export const scheduleDockBadgeRefresh = controller.scheduleRefresh
