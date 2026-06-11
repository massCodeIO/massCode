import type { ChokidarOptions, FSWatcher } from 'chokidar'
import type { NotesPaths, NotesRuntimeCache } from './notes/runtime'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import { importEsm, log } from '../../../utils'
import { wasRecentAppDrawingChange } from './drawings'
import {
  getHttpPaths,
  peekHttpRuntimeCache,
  resetHttpRuntimeCache,
  syncHttpRuntimeWithDisk,
} from './http'
import {
  getNotesPaths,
  peekNotesRuntimeCache,
  resetNotesPathsCache,
  resetNotesRuntimeCache,
  syncNoteFileWithDisk,
  syncNotesRuntimeWithDisk,
} from './notes/runtime'
import {
  ensureStateFile,
  getPaths,
  getVaultPath,
  type MarkdownRuntimeCache,
  type Paths,
  peekRuntimeCache,
  resetPathsCache,
  resetRuntimeCache,
  syncRuntimeWithDisk,
  syncSnippetFileWithDisk,
} from './runtime'
import { wasRecentAppFileChange } from './runtime/shared/appChanges'
import {
  getWatchPathSpaceId,
  isCodeWatchPath,
  isDrawingsWatchPath,
  isHttpWatchPath,
  isMathWatchPath,
  isNotesWatchPath,
  normalizeRelativeWatchPath,
  shouldIgnoreWatchPath,
  toCodeRelativePath,
  toNotesRelativePath,
} from './watcherPaths'

// Above this number of buffered file changes an incremental per-file sync
// is unlikely to beat one full re-read, so the watcher escalates instead.
const MAX_PENDING_SYNC_FILE_PATHS = 25

let markdownWatcher: FSWatcher | null = null
let markdownWatchTimer: NodeJS.Timeout | null = null
let watchedVaultPath: string | null = null
const pendingCodeFilePaths = new Set<string>()
const pendingNoteFilePaths = new Set<string>()
let hasPendingFullSync = false
let hasPendingMathSync = false
let hasPendingNotesSync = false
let hasPendingHttpSync = false
let hasPendingDrawingsSync = false
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

function syncChangedSnippetFiles(
  paths: Paths,
  changedFilePaths: string[],
): MarkdownRuntimeCache {
  let nextCache: MarkdownRuntimeCache | null = null

  for (const changedFilePath of changedFilePaths) {
    nextCache = syncSnippetFileWithDisk(paths, changedFilePath)
    if (!nextCache) {
      return syncRuntimeWithDisk(paths)
    }
  }

  return nextCache ?? syncRuntimeWithDisk(paths)
}

function syncChangedNoteFiles(
  notesPaths: NotesPaths,
  changedFilePaths: string[],
): NotesRuntimeCache {
  let nextCache: NotesRuntimeCache | null = null

  for (const changedFilePath of changedFilePaths) {
    nextCache = syncNoteFileWithDisk(notesPaths, changedFilePath)
    if (!nextCache) {
      return syncNotesRuntimeWithDisk(notesPaths)
    }
  }

  return nextCache ?? syncNotesRuntimeWithDisk(notesPaths)
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
  const changedHttpPath = isHttpWatchPath(changedPath)
  const changedDrawingsPath = isDrawingsWatchPath(changedPath)
  const changedCodeRelativePath
    = changedPath && changedCodePath ? toCodeRelativePath(changedPath) : null

  // Echoes of the app's own file writes are skipped entirely: the runtime
  // caches were already updated by the storage layer before the write.
  const isAppEcho
    = changedPath !== null
      && !forceFullSync
      && (changedNotesPath || changedCodePath)
      && wasRecentAppFileChange(path.join(vaultRootPath, changedPath))

  if (changedNotesPath && !isAppEcho) {
    const changedNoteRelativePath
      = changedPath && !forceFullSync ? toNotesRelativePath(changedPath) : null

    if (changedNoteRelativePath) {
      pendingNoteFilePaths.add(changedNoteRelativePath)
      if (pendingNoteFilePaths.size > MAX_PENDING_SYNC_FILE_PATHS) {
        hasPendingNotesSync = true
      }
    }
    else {
      hasPendingNotesSync = true
    }
  }

  if (changedMathPath) {
    hasPendingMathSync = true
  }

  if (changedHttpPath) {
    hasPendingHttpSync = true
  }

  if (
    changedDrawingsPath
    && !(changedPath && wasRecentAppDrawingChange(vaultRootPath, changedPath))
  ) {
    // Echoes of the app's own drawing writes are skipped entirely:
    // re-syncing them would only re-read data the renderer already has.
    hasPendingDrawingsSync = true
  }

  if (changedNotesPath) {
    // Notes space has separate runtime cache sync path.
  }
  else if (changedMathPath) {
    // Math space has no main-process cache to sync; broadcast only.
  }
  else if (changedHttpPath) {
    // HTTP space has separate runtime cache sync path.
  }
  else if (changedDrawingsPath) {
    // Drawings space has no main-process cache to sync; broadcast only.
  }
  else if (forceFullSync || !changedPath) {
    hasPendingFullSync = true

    if (forceFullSync && !changedPath) {
      hasPendingNotesSync = true
      hasPendingHttpSync = true
      hasPendingDrawingsSync = true
    }
  }
  else if (changedCodeRelativePath) {
    if (!isAppEcho) {
      pendingCodeFilePaths.add(changedCodeRelativePath)
      if (pendingCodeFilePaths.size > MAX_PENDING_SYNC_FILE_PATHS) {
        hasPendingFullSync = true
      }
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
      const previousHttpCache = peekHttpRuntimeCache()
      const changedCodeFilePaths = hasPendingFullSync
        ? null
        : [...pendingCodeFilePaths]
      const changedNoteFilePaths = hasPendingNotesSync
        ? null
        : [...pendingNoteFilePaths]
      const shouldNotifyMath = hasPendingMathSync
      const shouldNotifyDrawings = hasPendingDrawingsSync
      const shouldSyncCode
        = hasPendingFullSync
          || (changedCodeFilePaths !== null && changedCodeFilePaths.length > 0)
      const shouldSyncNotes
        = hasPendingNotesSync
          || (changedNoteFilePaths !== null && changedNoteFilePaths.length > 0)
      const shouldSyncHttp = hasPendingHttpSync

      hasPendingFullSync = false
      hasPendingMathSync = false
      hasPendingNotesSync = false
      hasPendingHttpSync = false
      hasPendingDrawingsSync = false
      pendingCodeFilePaths.clear()
      pendingNoteFilePaths.clear()

      let nextCache = previousCache
      if (shouldSyncCode) {
        nextCache
          = changedCodeFilePaths && changedCodeFilePaths.length > 0
            ? syncChangedSnippetFiles(paths, changedCodeFilePaths)
            : syncRuntimeWithDisk(paths)
      }

      let nextNotesCache = previousNotesCache
      if (shouldSyncNotes) {
        const notesPaths = getNotesPaths(vaultRootPath)
        nextNotesCache
          = changedNoteFilePaths && changedNoteFilePaths.length > 0
            ? syncChangedNoteFiles(notesPaths, changedNoteFilePaths)
            : syncNotesRuntimeWithDisk(notesPaths)
      }

      const nextHttpCache = shouldSyncHttp
        ? syncHttpRuntimeWithDisk(getHttpPaths(vaultRootPath))
        : previousHttpCache

      const hasCodeChanges
        = shouldSyncCode && (!previousCache || nextCache !== previousCache)
      const hasNotesChanges
        = shouldSyncNotes
          && (!previousNotesCache || nextNotesCache !== previousNotesCache)
      const hasMathChanges = shouldNotifyMath
      const hasDrawingsChanges = shouldNotifyDrawings
      const hasHttpChanges
        = shouldSyncHttp
          && (!previousHttpCache || nextHttpCache !== previousHttpCache)

      if (
        hasCodeChanges
        || hasNotesChanges
        || hasMathChanges
        || hasHttpChanges
        || hasDrawingsChanges
      ) {
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
  pendingCodeFilePaths.clear()
  pendingNoteFilePaths.clear()
  hasPendingFullSync = false
  hasPendingMathSync = false
  hasPendingNotesSync = false
  hasPendingHttpSync = false
  hasPendingDrawingsSync = false
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
  resetPathsCache()
  resetNotesPathsCache()
}

export function startMarkdownWatcher(): void {
  const vaultRootPath = getVaultPath()
  const paths = getPaths(vaultRootPath)
  const runtimeCache = peekRuntimeCache()
  const notesPaths = getNotesPaths(vaultRootPath)
  const notesRuntimeCache = peekNotesRuntimeCache()
  const httpPaths = getHttpPaths(vaultRootPath)
  const httpRuntimeCache = peekHttpRuntimeCache()

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

    if (
      !httpRuntimeCache
      || httpRuntimeCache.paths.httpRoot !== httpPaths.httpRoot
    ) {
      syncHttpRuntimeWithDisk(httpPaths)
    }

    return
  }

  stopMarkdownWatcher()
  ensureStateFile(paths)
  syncRuntimeWithDisk(paths)
  syncNotesRuntimeWithDisk(notesPaths)
  syncHttpRuntimeWithDisk(httpPaths)

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
