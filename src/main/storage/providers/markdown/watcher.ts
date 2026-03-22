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
  CODE_SPACE_ID,
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
const CODE_SPACE_WATCH_PREFIX = `${SPACES_DIR_NAME.toLowerCase()}/${CODE_SPACE_ID.toLowerCase()}`

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
  watchRootPath: string,
  changedPath: string,
): string | null {
  const normalizedChangedPath = changedPath.trim()
  if (!normalizedChangedPath) {
    return null
  }

  const absolutePath = path.isAbsolute(normalizedChangedPath)
    ? normalizedChangedPath
    : path.join(watchRootPath, normalizedChangedPath)
  const relativePath = toPosixPath(path.relative(watchRootPath, absolutePath))

  if (!relativePath || relativePath === '.' || relativePath.startsWith('../')) {
    return null
  }

  return relativePath
}

function shouldIgnoreWatchPath(
  watchRootPath: string,
  watchPath: string,
): boolean {
  const relativePath = normalizeRelativeWatchPath(watchRootPath, watchPath)
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

function isCodeWatchPath(relativePath: string | null): boolean {
  if (!relativePath) {
    return false
  }

  const normalizedRelativePath = relativePath.toLowerCase()
  return (
    normalizedRelativePath === CODE_SPACE_WATCH_PREFIX
    || normalizedRelativePath.startsWith(`${CODE_SPACE_WATCH_PREFIX}/`)
  )
}

function toCodeRelativePath(relativePath: string): string | null {
  const normalizedRelativePath = relativePath.toLowerCase()

  if (normalizedRelativePath === CODE_SPACE_WATCH_PREFIX) {
    return null
  }

  const codePrefix = `${CODE_SPACE_WATCH_PREFIX}/`
  if (!normalizedRelativePath.startsWith(codePrefix)) {
    return null
  }

  return relativePath.slice(codePrefix.length)
}

function scheduleStateSync(
  vaultRootPath: string,
  paths: Paths,
  changedPath: string | null,
  forceFullSync = false,
): void {
  const changedNotesPath = isNotesWatchPath(changedPath)
  const changedCodePath = isCodeWatchPath(changedPath)
  const changedCodeRelativePath
    = changedPath && changedCodePath ? toCodeRelativePath(changedPath) : null

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
        ? syncNotesRuntimeWithDisk(getNotesPaths(vaultRootPath))
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
