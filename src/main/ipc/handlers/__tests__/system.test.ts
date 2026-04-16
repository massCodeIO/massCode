import { beforeEach, describe, expect, it, vi } from 'vitest'

const registeredHandlers = new Map<string, (...args: any[]) => unknown>()
const handle = vi.fn(
  (channel: string, handler: (...args: any[]) => unknown) => {
    registeredHandlers.set(channel, handler)
  },
)
const relaunch = vi.fn()
const quit = vi.fn()
const openExternal = vi.fn()
const showItemInFolder = vi.fn()
const getDirectoryState = vi.fn()
const moveVault = vi.fn()
const getVaultPath = vi.fn(() => '/current-vault')
const preferencesSet = vi.fn()

vi.mock('electron', () => ({
  app: {
    relaunch,
    quit,
  },
  ipcMain: {
    handle,
  },
  shell: {
    openExternal,
    showItemInFolder,
  },
}))

vi.mock('../../../currencyRates', () => ({
  getCurrencyRates: vi.fn(),
  refreshCryptoRatesForced: vi.fn(),
  refreshFiatRatesForced: vi.fn(),
}))

vi.mock('../../../storage/providers/markdown/notes/runtime', () => ({
  findNoteById: vi.fn(),
  getNotesFolderPathById: vi.fn(),
  getNotesPaths: vi.fn(),
  getNotesRuntimeCache: vi.fn(),
}))

vi.mock('../../../storage/providers/markdown/runtime/moveVault', () => ({
  getDirectoryState,
  moveVault,
}))

vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath,
}))

vi.mock('../../../store', () => ({
  store: {
    preferences: {
      set: preferencesSet,
    },
  },
}))

beforeEach(() => {
  registeredHandlers.clear()
  vi.clearAllMocks()
})

describe('registerSystemHandlers', () => {
  it('registers a handler for directory state lookup', async () => {
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(handle).toHaveBeenCalledWith(
      'system:get-directory-state',
      expect.any(Function),
    )
  })

  it('registers a handler for moving the vault', async () => {
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(handle).toHaveBeenCalledWith(
      'system:move-vault',
      expect.any(Function),
    )
  })

  it('delegates directory state lookup to the runtime helper', async () => {
    getDirectoryState.mockReturnValue({ exists: true, isEmpty: false })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    const result = registeredHandlers.get('system:get-directory-state')?.(
      undefined,
      { path: '/target-vault' },
    )

    expect(getDirectoryState).toHaveBeenCalledWith('/target-vault')
    expect(result).toEqual({ exists: true, isEmpty: false })
  })

  it('moves the current vault and updates the configured path after success', async () => {
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    const result = registeredHandlers.get('system:move-vault')?.(undefined, {
      targetPath: '/next-vault',
    })

    expect(getVaultPath).toHaveBeenCalledTimes(1)
    expect(moveVault).toHaveBeenCalledWith('/current-vault', '/next-vault')
    expect(preferencesSet).toHaveBeenCalledWith(
      'storage.vaultPath',
      '/next-vault',
    )
    expect(result).toEqual({ vaultPath: '/next-vault' })
  })

  it('does not update the configured path when moving the vault fails', async () => {
    moveVault.mockImplementation(() => {
      throw new Error('move failed')
    })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(() =>
      registeredHandlers.get('system:move-vault')?.(undefined, {
        targetPath: '/next-vault',
      }),
    ).toThrow('move failed')
    expect(preferencesSet).not.toHaveBeenCalled()
  })
})
