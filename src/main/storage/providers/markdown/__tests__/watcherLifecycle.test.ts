import { beforeEach, describe, expect, it, vi } from 'vitest'

interface CloudDownloadConfiguration {
  onDownloaded: (absolutePath: string) => void
  onQueueActivity: () => void
}

async function flushImmediate(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve))
  await Promise.resolve()
}

async function setup() {
  vi.resetModules()

  const vaultRootPath = '/vault'
  const paths = {
    inboxDirPath: '/vault/code/.masscode/inbox',
    metaDirPath: '/vault/code/.masscode',
    statePath: '/vault/code/.masscode/state.json',
    trashDirPath: '/vault/code/.masscode/trash',
    vaultPath: '/vault/code',
  }
  const notesPaths = {
    assetsPath: '/vault/notes/.masscode/assets',
    inboxDirPath: '/vault/notes/.masscode/inbox',
    legacyAssetsPath: '/vault/notes/assets',
    metaDirPath: '/vault/notes/.masscode',
    notesRoot: '/vault/notes',
    statePath: '/vault/notes/.masscode/state.json',
    trashDirPath: '/vault/notes/.masscode/trash',
  }
  const httpPaths = {
    httpRoot: '/vault/http',
    statePath: '/vault/http/.state.yaml',
  }
  const cloudConfigurations: CloudDownloadConfiguration[] = []
  const send = vi.fn()
  const log = vi.fn()
  const broadcastNotesAssetReady = vi.fn()
  const getPaths = vi.fn(() => paths)
  const getVaultPath = vi.fn(() => vaultRootPath)
  const ensureStateFile = vi.fn()
  const syncRuntimeWithDisk = vi.fn()
  const syncNotesRuntimeWithDisk = vi.fn()
  const scheduleNotesAssetsMigration = vi.fn()
  const peekNotesRuntimeCache = vi.fn(
    (): { paths: typeof notesPaths } | null => null,
  )
  const syncHttpRuntimeWithDisk = vi.fn()
  const resetCloudDownloads = vi.fn()
  const flushPendingStateWritesOrThrow = vi.fn()
  const resetStateWriter = vi.fn()
  const resetRuntimeCache = vi.fn()
  const resetNotesRuntimeCache = vi.fn()
  const resetHttpRuntimeCache = vi.fn()
  const resetPathsCache = vi.fn()
  const resetNotesPathsCache = vi.fn()
  const getPendingCloudPaths = vi.fn(() => ['/vault/.masscode/state.json'])
  const configureCloudDownloads = vi.fn(
    (configuration: CloudDownloadConfiguration) => {
      cloudConfigurations.push(configuration)
    },
  )
  const watcherHandlers = new Map<string, (changedPath: string) => void>()
  const watcher = {
    close: vi.fn(),
    on: vi.fn((event: string, handler: (changedPath: string) => void) => {
      watcherHandlers.set(event, handler)
      return watcher
    }),
  }
  const watch = vi.fn(() => watcher)
  const importEsm = vi.fn(async () => ({ watch }))

  vi.doMock('electron', () => ({
    BrowserWindow: {
      getAllWindows: () => [{ webContents: { send } }],
    },
  }))

  vi.doMock('../../../../utils', () => ({
    importEsm,
    log,
  }))

  vi.doMock('../../../../dockBadge', () => ({
    scheduleDockBadgeRefresh: vi.fn(),
  }))

  vi.doMock('../cloudDownloads', () => ({
    configureCloudDownloads,
    getPendingCloudPaths,
    resetCloudDownloads,
  }))

  vi.doMock('../drawings', () => ({
    wasRecentAppDrawingChange: vi.fn(() => false),
  }))

  vi.doMock('../http', () => ({
    getHttpPaths: vi.fn(() => httpPaths),
    peekHttpRuntimeCache: vi.fn(() => null),
    resetHttpRuntimeCache,
    syncHttpRuntimeWithDisk,
  }))

  vi.doMock('../notes/runtime', () => ({
    getNotesAssetNameFromAbsolutePath: vi.fn(
      (_paths: typeof notesPaths, absolutePath: string) => {
        const parentPath = absolutePath.slice(0, absolutePath.lastIndexOf('/'))
        return parentPath === notesPaths.assetsPath
          || parentPath === notesPaths.legacyAssetsPath
          ? absolutePath.slice(absolutePath.lastIndexOf('/') + 1)
          : null
      },
    ),
    getNotesPaths: vi.fn(() => notesPaths),
    parseNotesAssetName: vi.fn((fileName: string) => ({ fileName })),
    peekNotesRuntimeCache,
    refreshPendingNoteFiles: vi.fn(() => ({ changed: false, remaining: 0 })),
    resetNotesPathsCache,
    resetNotesRuntimeCache,
    scheduleNotesAssetsMigration,
    syncNoteFileWithDisk: vi.fn(),
    syncNotesRuntimeWithDisk,
  }))

  vi.doMock('../notesAssetEvents', () => ({
    broadcastNotesAssetReady,
  }))

  vi.doMock('../runtime', () => ({
    ensureStateFile,
    getPaths,
    getVaultPath,
    peekRuntimeCache: vi.fn(() => null),
    refreshPendingSnippetFiles: vi.fn(() => ({
      changed: false,
      remaining: 0,
    })),
    resetPathsCache,
    resetRuntimeCache,
    syncRuntimeWithDisk,
    syncSnippetFileWithDisk: vi.fn(),
  }))

  vi.doMock('../runtime/shared/appChanges', () => ({
    wasRecentAppFileChange: vi.fn(() => false),
  }))

  vi.doMock('../runtime/shared/cloudFiles', () => ({
    getFileAvailability: vi.fn(() => ({
      exists: true,
      isCloudPlaceholder: false,
      stats: null,
    })),
  }))

  vi.doMock('../runtime/shared/guardedRead', () => ({
    isCloudFileNotDownloadedError: (error: unknown) =>
      error instanceof Error
      && error.message.startsWith('CLOUD_FILE_NOT_DOWNLOADED'),
  }))

  vi.doMock('../runtime/shared/stateWriter', () => ({
    flushPendingStateWritesOrThrow,
    resetStateWriter,
  }))

  const { prepareMarkdownWatcher, startMarkdownWatcher, stopMarkdownWatcher }
    = await import('../watcher')

  return {
    cloudConfigurations,
    broadcastNotesAssetReady,
    configureCloudDownloads,
    ensureStateFile,
    flushPendingStateWritesOrThrow,
    getPaths,
    getPendingCloudPaths,
    importEsm,
    log,
    notesPaths,
    paths,
    peekNotesRuntimeCache,
    prepareMarkdownWatcher,
    resetCloudDownloads,
    resetHttpRuntimeCache,
    resetNotesPathsCache,
    resetNotesRuntimeCache,
    resetPathsCache,
    resetRuntimeCache,
    resetStateWriter,
    scheduleNotesAssetsMigration,
    send,
    startMarkdownWatcher,
    stopMarkdownWatcher,
    syncHttpRuntimeWithDisk,
    syncNotesRuntimeWithDisk,
    syncRuntimeWithDisk,
    watch,
    watcher,
    watcherHandlers,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('markdown watcher cloud bootstrap', () => {
  it('broadcasts an asset hydrated before the watcher starts', async () => {
    const context = await setup()

    context.prepareMarkdownWatcher()
    context.cloudConfigurations[0].onDownloaded(
      '/vault/notes/.masscode/assets/abcdefghijklmnop.png',
    )

    expect(context.broadcastNotesAssetReady).toHaveBeenCalledWith(
      'abcdefghijklmnop.png',
    )
  })

  it('preserves the prepared cloud queue on the initial start', async () => {
    const context = await setup()

    context.prepareMarkdownWatcher()
    context.startMarkdownWatcher()
    await flushImmediate()

    expect(context.resetCloudDownloads).not.toHaveBeenCalled()
    expect(context.configureCloudDownloads).toHaveBeenCalledTimes(2)
  })

  it('resets cloud downloads on a later stop and restart', async () => {
    const context = await setup()

    context.prepareMarkdownWatcher()
    context.startMarkdownWatcher()
    await flushImmediate()
    context.stopMarkdownWatcher()
    context.startMarkdownWatcher()

    expect(context.resetCloudDownloads).toHaveBeenCalledTimes(2)
  })

  it('flushes and cleans state writes before resetting cloud downloads', async () => {
    const context = await setup()
    const lifecycleOrder: string[] = []
    context.flushPendingStateWritesOrThrow.mockImplementation(() => {
      lifecycleOrder.push('flush')
    })
    context.resetStateWriter.mockImplementation(() => {
      lifecycleOrder.push('cleanup')
    })
    context.resetRuntimeCache.mockImplementation(() => {
      lifecycleOrder.push('runtime-reset')
    })
    context.resetCloudDownloads.mockImplementation(() => {
      lifecycleOrder.push('cloud-reset')
    })

    context.stopMarkdownWatcher()

    expect(lifecycleOrder).toEqual([
      'flush',
      'runtime-reset',
      'cleanup',
      'cloud-reset',
    ])
    expect(context.flushPendingStateWritesOrThrow).toHaveBeenCalledTimes(1)
    expect(context.resetStateWriter).toHaveBeenCalledTimes(1)
  })

  it('keeps the watcher running when state writes remain', async () => {
    const context = await setup()
    context.prepareMarkdownWatcher()
    context.startMarkdownWatcher()
    await flushImmediate()
    vi.clearAllMocks()
    context.flushPendingStateWritesOrThrow.mockImplementationOnce(() => {
      throw new Error('Pending state writes remain for: state.json')
    })

    expect(() => context.stopMarkdownWatcher()).toThrow(
      'Pending state writes remain',
    )
    expect(context.watcher.close).not.toHaveBeenCalled()
    expect(context.resetStateWriter).not.toHaveBeenCalled()
    expect(context.resetCloudDownloads).not.toHaveBeenCalled()
    expect(context.resetRuntimeCache).not.toHaveBeenCalled()
    expect(context.resetNotesRuntimeCache).not.toHaveBeenCalled()
    expect(context.resetHttpRuntimeCache).not.toHaveBeenCalled()
    expect(context.resetPathsCache).not.toHaveBeenCalled()
    expect(context.resetNotesPathsCache).not.toHaveBeenCalled()

    expect(() => context.stopMarkdownWatcher()).not.toThrow()
    expect(context.watcher.close).toHaveBeenCalledTimes(1)
    expect(context.resetStateWriter).toHaveBeenCalledTimes(1)
    expect(context.resetCloudDownloads).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending initial start when start is called again', async () => {
    const context = await setup()

    context.prepareMarkdownWatcher()
    context.startMarkdownWatcher()
    context.startMarkdownWatcher()
    await flushImmediate()

    expect(context.resetCloudDownloads).toHaveBeenCalledTimes(1)
    expect(context.watch).toHaveBeenCalledTimes(1)
  })

  it('routes managed watch and asset hydration events without Notes sync', async () => {
    const context = await setup()
    context.startMarkdownWatcher()
    await flushImmediate()
    expect(context.syncNotesRuntimeWithDisk).toHaveBeenCalledTimes(1)
    context.peekNotesRuntimeCache.mockReturnValue({
      paths: context.notesPaths,
    })

    context.watcherHandlers.get('change')?.(
      '/vault/notes/.masscode/assets/abcdefghijklmnop.png',
    )
    context.cloudConfigurations[0].onDownloaded(
      '/vault/notes/assets/ponmlkjihgfedcba.png',
    )

    expect(context.broadcastNotesAssetReady).toHaveBeenNthCalledWith(
      1,
      'abcdefghijklmnop.png',
    )
    expect(context.broadcastNotesAssetReady).toHaveBeenNthCalledWith(
      2,
      'ponmlkjihgfedcba.png',
    )
    expect(context.syncNotesRuntimeWithDisk).toHaveBeenCalledTimes(1)
    expect(context.scheduleNotesAssetsMigration).toHaveBeenCalledTimes(1)
  })

  it('retries startup after a legacy cloud state file is hydrated', async () => {
    const context = await setup()
    context.getPaths
      .mockImplementationOnce(() => {
        throw new Error('CLOUD_FILE_NOT_DOWNLOADED: legacy state')
      })
      .mockReturnValue(context.paths)

    expect(() => context.startMarkdownWatcher()).not.toThrow()

    const recovery = context.cloudConfigurations[0]
    expect(recovery).toBeDefined()
    recovery.onDownloaded('/vault/.masscode/state.json')
    await flushImmediate()

    expect(context.getPaths).toHaveBeenCalledTimes(2)
    expect(context.ensureStateFile).toHaveBeenCalledWith(context.paths)
    expect(context.syncRuntimeWithDisk).toHaveBeenCalledWith(context.paths)
    expect(context.syncNotesRuntimeWithDisk).toHaveBeenCalledTimes(1)
    expect(context.syncHttpRuntimeWithDisk).toHaveBeenCalledTimes(1)
    expect(context.importEsm).toHaveBeenCalledWith('chokidar')
    expect(context.watch).toHaveBeenCalledWith(
      '/vault',
      expect.objectContaining({ ignoreInitial: true, persistent: true }),
    )
    expect(context.send).toHaveBeenCalledWith('system:storage-synced')
  })

  it('keeps waiting when another cloud state file blocks the retry', async () => {
    const context = await setup()
    context.getPaths.mockImplementation(() => {
      throw new Error('CLOUD_FILE_NOT_DOWNLOADED: legacy state')
    })

    context.startMarkdownWatcher()
    context.cloudConfigurations[0].onDownloaded('/vault/.masscode/state.json')
    await flushImmediate()

    expect(context.getPaths).toHaveBeenCalledTimes(2)
    expect(context.configureCloudDownloads).toHaveBeenCalledTimes(2)
    expect(context.ensureStateFile).not.toHaveBeenCalled()
    expect(context.send).not.toHaveBeenCalledWith('system:storage-synced')
  })

  it('retries once when hydration finished before recovery was configured', async () => {
    const context = await setup()
    context.getPendingCloudPaths.mockReturnValue([])
    context.getPaths
      .mockImplementationOnce(() => {
        throw new Error('CLOUD_FILE_NOT_DOWNLOADED: legacy state')
      })
      .mockReturnValue(context.paths)

    context.startMarkdownWatcher()
    await flushImmediate()

    expect(context.getPaths).toHaveBeenCalledTimes(2)
    expect(context.ensureStateFile).toHaveBeenCalledWith(context.paths)
    expect(context.send).toHaveBeenCalledWith('system:storage-synced')
  })

  it('ignores a hydration callback after watcher shutdown', async () => {
    const context = await setup()
    context.getPaths.mockImplementationOnce(() => {
      throw new Error('CLOUD_FILE_NOT_DOWNLOADED: legacy state')
    })

    context.startMarkdownWatcher()
    const recovery = context.cloudConfigurations[0]
    context.stopMarkdownWatcher()
    recovery.onDownloaded('/vault/.masscode/state.json')
    await flushImmediate()

    expect(context.getPaths).toHaveBeenCalledTimes(1)
    expect(context.send).not.toHaveBeenCalledWith('system:storage-synced')
  })

  it('still propagates non-cloud startup errors', async () => {
    const context = await setup()
    context.getPaths.mockImplementationOnce(() => {
      throw new Error('EACCES')
    })

    expect(() => context.startMarkdownWatcher()).toThrow('EACCES')
    expect(context.configureCloudDownloads).not.toHaveBeenCalled()
    expect(context.log).not.toHaveBeenCalled()
  })
})
