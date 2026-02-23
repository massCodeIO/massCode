import { BrowserWindow } from 'electron'
import fs from 'fs-extra'
import {
  areRuntimeCachesEqual,
  ensureStateFile,
  getPaths,
  getVaultPath,
  type Paths,
  peekRuntimeCache,
  resetRuntimeCache,
  syncRuntimeWithDisk,
} from './runtime'

let markdownWatcher: fs.FSWatcher | null = null
let markdownWatchTimer: NodeJS.Timeout | null = null
let watchedVaultPath: string | null = null

function scheduleStateSync(paths: Paths): void {
  if (markdownWatchTimer) {
    clearTimeout(markdownWatchTimer)
    markdownWatchTimer = null
  }

  markdownWatchTimer = setTimeout(() => {
    try {
      const previousCache = peekRuntimeCache()
      const nextCache = syncRuntimeWithDisk(paths)

      if (!previousCache || !areRuntimeCachesEqual(previousCache, nextCache)) {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('system:storage-synced')
        })
      }
    }
    catch {}
  }, 250)
}

export function stopMarkdownWatcher(): void {
  if (markdownWatchTimer) {
    clearTimeout(markdownWatchTimer)
    markdownWatchTimer = null
  }

  if (markdownWatcher) {
    markdownWatcher.close()
    markdownWatcher = null
  }

  watchedVaultPath = null
  resetRuntimeCache()
}

export function startMarkdownWatcher(): void {
  const paths = getPaths(getVaultPath())
  const runtimeCache = peekRuntimeCache()

  if (markdownWatcher && watchedVaultPath === paths.vaultPath) {
    if (!runtimeCache || runtimeCache.paths.vaultPath !== paths.vaultPath) {
      ensureStateFile(paths)
      syncRuntimeWithDisk(paths)
    }

    return
  }

  stopMarkdownWatcher()
  ensureStateFile(paths)
  syncRuntimeWithDisk(paths)

  try {
    markdownWatcher = fs.watch(paths.vaultPath, { recursive: true }, () =>
      scheduleStateSync(paths))
  }
  catch {
    markdownWatcher = fs.watch(paths.vaultPath, () => scheduleStateSync(paths))
  }

  watchedVaultPath = paths.vaultPath
}
