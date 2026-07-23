import type { Event as ElectronEvent } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const context = vi.hoisted(() => {
  const appHandlers = new Map<string, (...args: unknown[]) => void>()

  return {
    appHandlers,
    appQuit: vi.fn(),
    cleanupDockBadge: vi.fn(),
    log: vi.fn(),
    setQuitting: vi.fn(),
    stopMarkdownWatcher: vi.fn(),
    stopTasksCleanupScheduler: vi.fn(),
    stopThemeWatcher: vi.fn(),
    storeAppSet: vi.fn(),
  }
})

vi.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch: vi.fn(),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      context.appHandlers.set(event, handler)
    }),
    quit: context.appQuit,
    requestSingleInstanceLock: () => true,
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: () => new Promise(() => {}),
  },
  BrowserWindow: {
    getFocusedWindow: () => null,
  },
  ipcMain: {
    once: vi.fn(),
  },
  Menu: {
    setApplicationMenu: vi.fn(),
  },
  protocol: {
    handle: vi.fn(),
  },
  screen: {
    getAllDisplays: () => [],
  },
}))

vi.mock('../api', () => ({ initApi: vi.fn() }))
vi.mock('../dockBadge', () => ({
  cleanupDockBadge: context.cleanupDockBadge,
  refreshDockBadge: vi.fn(),
}))
vi.mock('../folderIcons', () => ({ resolveFolderIconResponse: vi.fn() }))
vi.mock('../ipc', () => ({ registerIPC: vi.fn() }))
vi.mock('../ipc/handlers/theme', () => ({
  startThemeWatcher: vi.fn(),
  stopThemeWatcher: context.stopThemeWatcher,
}))
vi.mock('../license', () => ({ validateStoredLicense: vi.fn() }))
vi.mock('../menu/main', () => ({ createMainMenu: vi.fn() }))
vi.mock('../quitState', () => ({
  isQuitting: () => false,
  setQuitting: context.setQuitting,
}))
vi.mock('../storage', () => ({
  prepareMarkdownWatcher: vi.fn(),
  startMarkdownWatcher: vi.fn(),
  stopMarkdownWatcher: context.stopMarkdownWatcher,
}))
vi.mock('../storage/providers/markdown/notes/runtime', () => ({
  getNotesPaths: vi.fn(),
  resolveNotesAsset: vi.fn(),
}))
vi.mock('../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: vi.fn(),
}))
vi.mock('../storage/providers/markdown/runtime/spaces', () => ({
  ensureFlatSpacesLayout: vi.fn(),
}))
vi.mock('../store', () => ({
  store: {
    app: {
      get: vi.fn(),
      set: context.storeAppSet,
    },
    preferences: {
      get: vi.fn(),
    },
  },
}))
vi.mock('../tasks', () => ({
  startTasksCleanupScheduler: vi.fn(),
  stopTasksCleanupScheduler: context.stopTasksCleanupScheduler,
}))
vi.mock('../updates', () => ({ checkForUpdates: vi.fn() }))
vi.mock('../utils', () => ({
  isSqliteFile: () => false,
  log: context.log,
}))
vi.mock('../windowBounds', () => ({
  DEFAULT_WINDOW_BOUNDS: {},
  normalizeWindowBounds: vi.fn(),
}))

const { handleBeforeQuit, handleMainWindowClose } = await import('../index')

function createEvent(): ElectronEvent {
  return {
    preventDefault: vi.fn(),
  } as unknown as ElectronEvent
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('main process safe quit lifecycle', () => {
  it('cancels quit before any other cleanup when state flush fails', () => {
    const event = createEvent()
    context.stopMarkdownWatcher.mockImplementationOnce(() => {
      throw new Error('Pending state writes remain')
    })

    handleBeforeQuit(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(context.setQuitting).toHaveBeenCalledWith(false)
    expect(context.log).toHaveBeenCalledWith(
      'Error stopping markdown watcher before quit',
      expect.any(Error),
    )
    expect(context.storeAppSet).not.toHaveBeenCalled()
    expect(context.stopThemeWatcher).not.toHaveBeenCalled()
    expect(context.stopTasksCleanupScheduler).not.toHaveBeenCalled()
    expect(context.cleanupDockBadge).not.toHaveBeenCalled()
  })

  it('continues normal cleanup after state flush succeeds', () => {
    const event = createEvent()

    handleBeforeQuit(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(context.setQuitting).toHaveBeenCalledWith(true)
    expect(context.stopThemeWatcher).toHaveBeenCalledTimes(1)
    expect(context.stopTasksCleanupScheduler).toHaveBeenCalledTimes(1)
    expect(context.cleanupDockBadge).toHaveBeenCalledTimes(1)
    expect(context.appQuit).not.toHaveBeenCalled()
  })

  it('requests safe quit without destroying a non-macOS window on failure', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    const closeEvent = createEvent()
    const quitEvent = createEvent()
    const window = {
      destroy: vi.fn(),
      hide: vi.fn(),
    }
    context.stopMarkdownWatcher.mockImplementationOnce(() => {
      throw new Error('Pending state writes remain')
    })
    context.appQuit.mockImplementationOnce(() => {
      context.appHandlers.get('before-quit')?.(quitEvent)
    })

    handleMainWindowClose(closeEvent, window as never)

    expect(closeEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(context.appQuit).toHaveBeenCalledTimes(1)
    expect(quitEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(window.destroy).not.toHaveBeenCalled()
    expect(window.hide).not.toHaveBeenCalled()
  })
})
