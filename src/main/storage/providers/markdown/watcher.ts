import type { ChokidarOptions, FSWatcher } from 'chokidar'
import path from 'node:path'
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
  INBOX_DIR_NAME,
  META_DIR_NAME,
  type Paths,
  peekRuntimeCache,
  resetRuntimeCache,
  SPACES_DIR_NAME,
  syncRuntimeWithDisk,
  syncSnippetFileWithDisk,
  TRASH_DIR_NAME,
} from './runtime'
import { toPosixPath } from './runtime/shared/path'

let markdownWatcher: FSWatcher | null = null
let markdownWatchTimer: NodeJS.Timeout | null = null
let watchedVaultPath: string | null = null
let pendingFilePath: string | null = null
let hasPendingFullSync = false
let hasPendingNotesSync = false
let watcherStartToken = 0
let chokidarWatchLoader: Promise<ChokidarWatch> | null = null

type ChokidarWatch = (
  path: string | readonly string[],
  options?: ChokidarOptions,
) => FSWatcher

const NOTES_SPACE_WATCH_PREFIX = `${SPACES_DIR_NAME.toLowerCase()}/notes`

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

function normalizeRelativeWatchPath(
  paths: Paths,
  changedPath: string,
): string | null {
  const normalizedChangedPath = changedPath.trim()
  if (!normalizedChangedPath) {
    return null
  }

  const absolutePath = path.isAbsolute(normalizedChangedPath)
    ? normalizedChangedPath
    : path.join(paths.vaultPath, normalizedChangedPath)
  const relativePath = toPosixPath(
    path.relative(paths.vaultPath, absolutePath),
  )

  if (!relativePath || relativePath === '.' || relativePath.startsWith('../')) {
    return null
  }

  return relativePath
}

function shouldIgnoreWatchPath(paths: Paths, watchPath: string): boolean {
  const relativePath = normalizeRelativeWatchPath(paths, watchPath)
  if (!relativePath) {
    return false
  }

  const basename = path.posix.basename(relativePath)

  // Never ignore meta files (both legacy and new)
  if (basename === '.meta.yaml' || basename === '.masscode-folder.yml') {
    return false
  }

  const normalizedRelativePath = relativePath.toLowerCase()

  // Never ignore __spaces__/ directory and its contents
  const spacesPrefix = SPACES_DIR_NAME.toLowerCase()
  if (
    normalizedRelativePath === spacesPrefix
    || normalizedRelativePath.startsWith(`${spacesPrefix}/`)
  ) {
    return false
  }

  const metaPrefix = META_DIR_NAME.toLowerCase()
  if (normalizedRelativePath === metaPrefix) {
    return false
  }

  const inboxPrefix = `${META_DIR_NAME}/${INBOX_DIR_NAME}`.toLowerCase()
  const trashPrefix = `${META_DIR_NAME}/${TRASH_DIR_NAME}`.toLowerCase()
  const canContainSnippets
    = normalizedRelativePath === inboxPrefix
      || normalizedRelativePath.startsWith(`${inboxPrefix}/`)
      || normalizedRelativePath === trashPrefix
      || normalizedRelativePath.startsWith(`${trashPrefix}/`)

  if (canContainSnippets) {
    return false
  }

  return normalizedRelativePath
    .split('/')
    .some(segment => segment.startsWith('.'))
}

function isNotesWatchPath(relativePath: string | null): boolean {
  if (!relativePath) {
    return false
  }

  const normalizedRelativePath = relativePath.toLowerCase()
  return (
    normalizedRelativePath === NOTES_SPACE_WATCH_PREFIX
    || normalizedRelativePath.startsWith(`${NOTES_SPACE_WATCH_PREFIX}/`)
  )
}

function scheduleStateSync(
  paths: Paths,
  changedPath: string | null,
  forceFullSync = false,
): void {
  const changedNotesPath = isNotesWatchPath(changedPath)
  if (changedNotesPath) {
    hasPendingNotesSync = true
  }

  if (changedNotesPath) {
    // Notes space has separate runtime cache sync path.
  }
  else if (forceFullSync || !changedPath) {
    hasPendingFullSync = true

    if (forceFullSync && !changedPath) {
      hasPendingNotesSync = true
    }
  }
  else if (pendingFilePath && pendingFilePath !== changedPath) {
    hasPendingFullSync = true
  }
  else if (changedPath) {
    pendingFilePath = changedPath
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
      const shouldSyncCode = hasPendingFullSync || changedFilePath !== null
      const shouldSyncNotes = hasPendingNotesSync

      hasPendingFullSync = false
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
        ? syncNotesRuntimeWithDisk(getNotesPaths(paths.vaultPath))
        : previousNotesCache

      const hasCodeChanges
        = shouldSyncCode && (!previousCache || nextCache !== previousCache)
      const hasNotesChanges
        = shouldSyncNotes
          && (!previousNotesCache || nextNotesCache !== previousNotesCache)

      if (hasCodeChanges || hasNotesChanges) {
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
  hasPendingNotesSync = false
  resetRuntimeCache()
  resetNotesRuntimeCache()
}

export function startMarkdownWatcher(): void {
  const paths = getPaths(getVaultPath())
  const runtimeCache = peekRuntimeCache()
  const notesPaths = getNotesPaths(paths.vaultPath)
  const notesRuntimeCache = peekNotesRuntimeCache()

  if (markdownWatcher && watchedVaultPath === paths.vaultPath) {
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

      const watcher = watch(paths.vaultPath, {
        awaitWriteFinish: {
          pollInterval: 100,
          stabilityThreshold: 200,
        },
        ignoreInitial: true,
        ignored: (watchPath: string) => shouldIgnoreWatchPath(paths, watchPath),
        persistent: true,
      })

      watcher
        .on('add', (changedPath: string) => {
          scheduleStateSync(
            paths,
            normalizeRelativeWatchPath(paths, changedPath),
          )
        })
        .on('change', (changedPath: string) => {
          scheduleStateSync(
            paths,
            normalizeRelativeWatchPath(paths, changedPath),
          )
        })
        .on('unlink', (changedPath: string) => {
          scheduleStateSync(
            paths,
            normalizeRelativeWatchPath(paths, changedPath),
          )
        })
        .on('addDir', (changedPath: string) => {
          scheduleStateSync(
            paths,
            normalizeRelativeWatchPath(paths, changedPath),
            true,
          )
        })
        .on('unlinkDir', (changedPath: string) => {
          scheduleStateSync(
            paths,
            normalizeRelativeWatchPath(paths, changedPath),
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
      watchedVaultPath = paths.vaultPath
    })
    .catch((error) => {
      if (startToken === watcherStartToken) {
        watchedVaultPath = null
      }

      log('storage:markdown:watcher-start', error)
    })
}
