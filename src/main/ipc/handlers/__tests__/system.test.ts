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
const startMarkdownWatcher = vi.fn()
const stopMarkdownWatcher = vi.fn()
const getVaultPath = vi.fn(() => '/current-vault')
const getPaths = vi.fn((vaultPath: string) => ({ vaultPath }))
interface SnippetFileLookup {
  filePath: string
  id: number
}

const getRuntimeCache = vi.fn((): { snippets: SnippetFileLookup[] } => ({
  snippets: [],
}))
const findSnippetById = vi.fn()
const i18nT = vi.fn()
const log = vi.fn()
const preferencesGet = vi.fn()
const preferencesSet = vi.fn()

vi.mock('electron', () => ({
  app: {
    relaunch,
    quit,
    // Транзитивный импорт main-меню читает версию при инициализации модуля.
    getVersion: vi.fn(() => '0.0.0-test'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn(),
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

vi.mock('../../../i18n', () => ({
  default: {
    t: i18nT,
  },
}))

vi.mock('../../../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils')>()

  return {
    ...actual,
    log,
  }
})

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

vi.mock('../../../storage/providers/markdown/runtime', () => ({
  findSnippetById,
  getPaths,
  getRuntimeCache,
}))

vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath,
}))

vi.mock('../../../storage/providers/markdown/watcher', () => ({
  startMarkdownWatcher,
  stopMarkdownWatcher,
}))

vi.mock('../../../store', () => ({
  store: {
    preferences: {
      // Транзитивный импорт i18n читает локаль при инициализации модуля.
      get: preferencesGet,
      set: preferencesSet,
    },
  },
}))

beforeEach(() => {
  registeredHandlers.clear()
  vi.clearAllMocks()
  moveVault.mockReset()
  startMarkdownWatcher.mockReset()
  i18nT.mockReset()
  log.mockReset()
  preferencesGet.mockReset()
  preferencesSet.mockReset()
  preferencesGet.mockImplementation((key: string) =>
    key === 'storage.vaultPath' ? '/current-vault' : undefined,
  )
  i18nT.mockImplementation((key: string) => key)
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

  it('registers a handler for switching the vault path', async () => {
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(handle).toHaveBeenCalledWith(
      'system:set-vault-path',
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
    expect(stopMarkdownWatcher).toHaveBeenCalledTimes(1)
    expect(startMarkdownWatcher).toHaveBeenCalledTimes(1)
    expect(stopMarkdownWatcher.mock.invocationCallOrder[0]).toBeLessThan(
      moveVault.mock.invocationCallOrder[0],
    )
    expect(moveVault.mock.invocationCallOrder[0]).toBeLessThan(
      preferencesSet.mock.invocationCallOrder[0],
    )
    expect(preferencesSet.mock.invocationCallOrder[0]).toBeLessThan(
      startMarkdownWatcher.mock.invocationCallOrder[0],
    )
    expect(result).toEqual({ vaultPath: '/next-vault' })
  })

  it('switches the configured vault between watcher stop and restart', async () => {
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    const result = registeredHandlers.get('system:set-vault-path')?.(
      undefined,
      { vaultPath: '/next-vault' },
    )

    expect(preferencesSet).toHaveBeenCalledWith(
      'storage.vaultPath',
      '/next-vault',
    )
    expect(stopMarkdownWatcher).toHaveBeenCalledTimes(1)
    expect(startMarkdownWatcher).toHaveBeenCalledTimes(1)
    expect(stopMarkdownWatcher.mock.invocationCallOrder[0]).toBeLessThan(
      preferencesSet.mock.invocationCallOrder[0],
    )
    expect(preferencesSet.mock.invocationCallOrder[0]).toBeLessThan(
      startMarkdownWatcher.mock.invocationCallOrder[0],
    )
    expect(result).toEqual({ vaultPath: '/next-vault' })
  })

  it('localizes an invalid vault path without restarting storage', async () => {
    i18nT.mockReturnValue('Localized vault path required')
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(() =>
      registeredHandlers.get('system:set-vault-path')?.(undefined, {
        vaultPath: '   ',
      }),
    ).toThrow('Localized vault path required')
    expect(i18nT).toHaveBeenCalledWith('messages:error.vaultPathRequired')
    expect(preferencesSet).not.toHaveBeenCalled()
    expect(stopMarkdownWatcher).not.toHaveBeenCalled()
    expect(startMarkdownWatcher).not.toHaveBeenCalled()
  })

  it('restores the previous vault when its watcher cannot start', async () => {
    startMarkdownWatcher.mockImplementationOnce(() => {
      throw new Error('watcher failed')
    })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(() =>
      registeredHandlers.get('system:set-vault-path')?.(undefined, {
        vaultPath: '/next-vault',
      }),
    ).toThrow('watcher failed')
    expect(preferencesSet.mock.calls).toEqual([
      ['storage.vaultPath', '/next-vault'],
      ['storage.vaultPath', '/current-vault'],
    ])
    expect(stopMarkdownWatcher).toHaveBeenCalledTimes(2)
    expect(startMarkdownWatcher).toHaveBeenCalledTimes(2)
  })

  it('preserves the vault switch error when watcher recovery also fails', async () => {
    const switchError = new Error('new watcher failed')
    const recoveryError = new Error('old watcher recovery failed')
    startMarkdownWatcher
      .mockImplementationOnce(() => {
        throw switchError
      })
      .mockImplementationOnce(() => {
        throw recoveryError
      })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(() =>
      registeredHandlers.get('system:set-vault-path')?.(undefined, {
        vaultPath: '/next-vault',
      }),
    ).toThrow(switchError)
    expect(log).toHaveBeenCalledWith(
      'storage:markdown:vault-switch-recovery',
      recoveryError,
    )
  })

  it('retries the target watcher after a successful vault move', async () => {
    startMarkdownWatcher.mockImplementationOnce(() => {
      throw new Error('first target watcher start failed')
    })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    const result = registeredHandlers.get('system:move-vault')?.(undefined, {
      targetPath: '/next-vault',
    })

    expect(result).toEqual({ vaultPath: '/next-vault' })
    expect(preferencesSet).toHaveBeenCalledWith(
      'storage.vaultPath',
      '/next-vault',
    )
    expect(stopMarkdownWatcher).toHaveBeenCalledTimes(2)
    expect(startMarkdownWatcher).toHaveBeenCalledTimes(2)
    expect(log).not.toHaveBeenCalled()
  })

  it('preserves the target watcher error when its retry also fails', async () => {
    const startError = new Error('target watcher failed')
    const recoveryError = new Error('target watcher recovery failed')
    startMarkdownWatcher
      .mockImplementationOnce(() => {
        throw startError
      })
      .mockImplementationOnce(() => {
        throw recoveryError
      })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(() =>
      registeredHandlers.get('system:move-vault')?.(undefined, {
        targetPath: '/next-vault',
      }),
    ).toThrow(startError)
    expect(preferencesSet).toHaveBeenCalledWith(
      'storage.vaultPath',
      '/next-vault',
    )
    expect(log).toHaveBeenCalledWith(
      'storage:markdown:vault-move-watcher-recovery',
      recoveryError,
    )
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
    expect(stopMarkdownWatcher).toHaveBeenCalledTimes(1)
    expect(startMarkdownWatcher).toHaveBeenCalledTimes(1)
    expect(stopMarkdownWatcher.mock.invocationCallOrder[0]).toBeLessThan(
      moveVault.mock.invocationCallOrder[0],
    )
    expect(moveVault.mock.invocationCallOrder[0]).toBeLessThan(
      startMarkdownWatcher.mock.invocationCallOrder[0],
    )
  })

  it('preserves a move error when restoring the old watcher also fails', async () => {
    const moveError = new Error('move failed')
    const recoveryError = new Error('old watcher recovery failed')
    moveVault.mockImplementation(() => {
      throw moveError
    })
    startMarkdownWatcher.mockImplementation(() => {
      throw recoveryError
    })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    expect(() =>
      registeredHandlers.get('system:move-vault')?.(undefined, {
        targetPath: '/next-vault',
      }),
    ).toThrow(moveError)
    expect(log).toHaveBeenCalledWith(
      'storage:markdown:vault-move-recovery',
      recoveryError,
    )
  })

  it('reveals a snippet file in the file manager', async () => {
    const snippet = { filePath: '.masscode/inbox/demo.md', id: 10 }

    findSnippetById.mockReturnValue(snippet)
    getRuntimeCache.mockReturnValue({ snippets: [snippet] })
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    const result = registeredHandlers.get(
      'system:show-snippet-in-file-manager',
    )?.(undefined, 10)

    expect(getPaths).toHaveBeenCalledWith('/current-vault')
    expect(getRuntimeCache).toHaveBeenCalledWith({
      vaultPath: '/current-vault',
    })
    expect(findSnippetById).toHaveBeenCalledWith([snippet], 10)
    expect(showItemInFolder).toHaveBeenCalledWith(
      '/current-vault/.masscode/inbox/demo.md',
    )
    expect(result).toBe(true)
  })

  it('does not reveal a missing snippet file', async () => {
    findSnippetById.mockReturnValue(undefined)
    const { registerSystemHandlers } = await import('../system')

    registerSystemHandlers()

    const result = registeredHandlers.get(
      'system:show-snippet-in-file-manager',
    )?.(undefined, 404)

    expect(showItemInFolder).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })
})
