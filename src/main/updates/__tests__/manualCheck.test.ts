import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdatesFromMenu } from '../index'

const { parent, app, showMessageBoxSync, checkForUpdates, getFocusedWindow }
  = vi.hoisted(() => {
    const parent = { isDestroyed: () => false }
    return {
      parent,
      app: { isPackaged: false },
      showMessageBoxSync: vi.fn(),
      checkForUpdates: vi.fn(),
      getFocusedWindow: vi.fn(() => parent),
    }
  })

vi.mock('electron', () => ({
  app,
  BrowserWindow: { getFocusedWindow },
  dialog: { showMessageBoxSync },
  shell: { openExternal: vi.fn() },
}))
vi.mock('electron-updater', () => ({ autoUpdater: { checkForUpdates } }))
vi.mock('../../i18n', () => ({ default: { t: (key: string) => key } }))
vi.mock('../../ipc', () => ({ send: vi.fn() }))
vi.mock('../../lifecycle', () => ({ requestLifecycleAction: vi.fn() }))
vi.mock('../../store', () => ({ store: { preferences: { get: () => true } } }))
vi.mock('../../utils', () => ({ log: vi.fn() }))

describe('manual update feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    app.isPackaged = false
  })

  it('shows the same no-update dialog attached to the focused window in development', async () => {
    await checkForUpdatesFromMenu()
    expect(showMessageBoxSync).toHaveBeenCalledWith(parent, {
      message: 'messages:update.noAvailable',
    })
  })

  it('attaches the packaged check result to the requesting window', async () => {
    app.isPackaged = true
    checkForUpdates.mockResolvedValue({ isUpdateAvailable: false })
    await checkForUpdatesFromMenu(parent as never)
    expect(showMessageBoxSync).toHaveBeenCalledWith(parent, {
      message: 'messages:update.noAvailable',
    })
  })

  it('still shows feedback when the requesting window has closed', async () => {
    await checkForUpdatesFromMenu({ isDestroyed: () => true } as never)
    expect(showMessageBoxSync).toHaveBeenCalledWith({
      message: 'messages:update.noAvailable',
    })
  })
})
