import type { ChokidarOptions, FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { importEsm, log } from '../../../utils'
import {
  getNotesPaths,
  peekNotesRuntimeCache,
  resetNotesRuntimeCache,
  syncNotesRuntimeWithDisk,
} from './notes/runtime'
import {
  ensureStateFile,
  getPaths,
  getVaultPath,
  type Paths,
  peekRuntimeCache,
  resetRuntimeCache,
  syncRuntimeWithDisk,
  syncSnippetFileWithDisk,
} from './runtime'
import {
  getWatchPathSpaceId,
  isCodeWatchPath,
  isMathWatchPath,
  isNotesWatchPath,
  normalizeRelativeWatchPath,
  shouldIgnoreWatchPath,
  toCodeRelativePath,
} from './watcherPaths'

let markdownWatcher: FSWatcher | null = null
let markdownWatchTimer: NodeJS.Timeout | null = null
let watchedVaultPath: string | null = null
let pendingFilePath: string | null = null
let hasPendingFullSync = false
let hasPendingMathSync = false
let hasPendingNotesSync = false
let watcherStartToken = 0
let chokidarWatchLoader: Promise<ChokidarWatch> | null = null

type ChokidarWatch = (
  path: string | readonly string[],
  options?: ChokidarOptions,
) => FSWatcher

async function getChokidarWatch(): Promise<ChokidarWatch> {
  if (chokidarWatchLoader) {
    return chokidarWatchLoader
  }

  chokidarWatchLoader = importEsm('chokidar')
    .then((module) => {
      const chokidarModule = module as {
        default?: {
          watch?: unknown
        }
        watch?: unknown
      }
      const watch = chokidarModule.default?.watch || chokidarModule.watch

      if (typeof watch !== 'function') {
        throw new TypeError('chokidar.watch is not available')
      }

      return watch as ChokidarWatch
    })
    .catch((error) => {
      chokidarWatchLoader = null
      throw error
    })

  return chokidarWatchLoader
}

function scheduleStateSync(
  vaultRootPath: string,
  paths: Paths,
  changedPath: string | null,
  forceFullSync = false,
): void {
  const changedSpaceId = getWatchPathSpaceId(changedPath)
  if (changedPath && !changedSpaceId) {
    return
  }

  const changedNotesPath = isNotesWatchPath(changedPath)
  const changedCodePath = isCodeWatchPath(changedPath)
  const changedMathPath = isMathWatchPath(changedPath)
  const changedCodeRelativePath
    = changedPath && changedCodePath ? toCodeRelativePath(changedPath) : null

  if (changedNotesPath) {
    hasPendingNotesSync = true
  }

  if (changedMathPath) {
    hasPendingMathSync = true
  }

  if (changedNotesPath) {
    // Notes space has separate runtime cache sync path.
  }
  else if (changedMathPath) {
    // Math space has no main-process cache to sync; broadcast only.
  }
  else if (forceFullSync || !changedPath) {
    hasPendingFullSync = true

    if (forceFullSync && !changedPath) {
      hasPendingNotesSync = true
    }
  }
  else if (changedCodeRelativePath) {
    if (pendingFilePath && pendingFilePath !== changedCodeRelativePath) {
      hasPendingFullSync = true
    }
    else {
      pendingFilePath = changedCodeRelativePath
    }
  }
  else if (!changedNotesPath) {
    hasPendingFullSync = true
    hasPendingNotesSync = true
  }

  if (markdownWatchTimer) {
    clearTimeout(markdownWatchTimer)
    markdownWatchTimer = null
  }

  markdownWatchTimer = setTimeout(() => {
    try {
      const previousCache = peekRuntimeCache()
      const previousNotesCache = peekNotesRuntimeCache()
      const changedFilePath = hasPendingFullSync ? null : pendingFilePath
      const shouldNotifyMath = hasPendingMathSync
      const shouldSyncCode = hasPendingFullSync || changedFilePath !== null
      const shouldSyncNotes = hasPendingNotesSync

      hasPendingFullSync = false
      hasPendingMathSync = false
      hasPendingNotesSync = false
      pendingFilePath = null

      let nextCache = previousCache
      if (shouldSyncCode) {
        if (changedFilePath) {
          const syncedSnippetCache = syncSnippetFileWithDisk(
            paths,
            changedFilePath,
          )
          nextCache = syncedSnippetCache || syncRuntimeWithDisk(paths)
        }
        else {
          nextCache = syncRuntimeWithDisk(paths)
        }
      }
      const nextNotesCache = shouldSyncNotes
        ? syncNotesRuntimeWithDisk(getNotesPaths(vaultRootPath))
        : previousNotesCache

      const hasCodeChanges
        = shouldSyncCode && (!previousCache || nextCache !== previousCache)
      const hasNotesChanges
        = shouldSyncNotes
          && (!previousNotesCache || nextNotesCache !== previousNotesCache)
      const hasMathChanges = shouldNotifyMath

      if (hasCodeChanges || hasNotesChanges || hasMathChanges) {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('system:storage-synced')
        })
      }
    }
    catch (error) {
      log('storage:markdown:watcher-sync', error)
    }
  }, 250)
}

export function stopMarkdownWatcher(): void {
  watcherStartToken += 1

  if (markdownWatchTimer) {
    clearTimeout(markdownWatchTimer)
    markdownWatchTimer = null
  }

  if (markdownWatcher) {
    void markdownWatcher.close()
    markdownWatcher = null
  }

  watchedVaultPath = null
  pendingFilePath = null
  hasPendingFullSync = false
  hasPendingMathSync = false
  hasPendingNotesSync = false
  resetRuntimeCache()
  resetNotesRuntimeCache()
}

export function startMarkdownWatcher(): void {
  const vaultRootPath = getVaultPath()
  const paths = getPaths(vaultRootPath)
  const runtimeCache = peekRuntimeCache()
  const notesPaths = getNotesPaths(vaultRootPath)
  const notesRuntimeCache = peekNotesRuntimeCache()

  if (markdownWatcher && watchedVaultPath === vaultRootPath) {
    if (!runtimeCache || runtimeCache.paths.vaultPath !== paths.vaultPath) {
      ensureStateFile(paths)
      syncRuntimeWithDisk(paths)
    }

    if (
      !notesRuntimeCache
      || notesRuntimeCache.paths.notesRoot !== notesPaths.notesRoot
    ) {
      syncNotesRuntimeWithDisk(notesPaths)
    }

    return
  }

  stopMarkdownWatcher()
  ensureStateFile(paths)
  syncRuntimeWithDisk(paths)
  syncNotesRuntimeWithDisk(notesPaths)

  const startToken = ++watcherStartToken

  void getChokidarWatch()
    .then((watch) => {
      if (startToken !== watcherStartToken) {
        return
      }

      const watcher = watch(vaultRootPath, {
        awaitWriteFinish: {
          pollInterval: 100,
          stabilityThreshold: 200,
        },
        ignoreInitial: true,
        ignored: (watchPath: string) =>
          shouldIgnoreWatchPath(vaultRootPath, watchPath),
        persistent: true,
      })

      watcher
        .on('add', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
          )
        })
        .on('change', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
          )
        })
        .on('unlink', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
          )
        })
        .on('addDir', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
            true,
          )
        })
        .on('unlinkDir', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
            true,
          )
        })
        .on('error', (error: unknown) => {
          log('storage:markdown:watcher-error', error)
        })

      if (startToken !== watcherStartToken) {
        void watcher.close()
        return
      }

      markdownWatcher = watcher
      watchedVaultPath = vaultRootPath
    })
    .catch((error) => {
      if (startToken === watcherStartToken) {
        watchedVaultPath = null
      }

      log('storage:markdown:watcher-start', error)
    })
}
