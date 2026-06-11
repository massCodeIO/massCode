import path from 'node:path'

// Own file mutations are remembered briefly so the vault watcher can skip
// re-syncing echoes of the app's own writes: the runtime caches are already
// updated synchronously by the storage layer before files hit the disk.
const RECENT_APP_CHANGE_TTL_MS = 2500
const recentAppFileChanges = new Map<string, number>()

export function rememberAppFileChange(absolutePath: string): void {
  const now = Date.now()

  for (const [knownPath, timestamp] of recentAppFileChanges) {
    if (now - timestamp > RECENT_APP_CHANGE_TTL_MS) {
      recentAppFileChanges.delete(knownPath)
    }
  }

  recentAppFileChanges.set(path.resolve(absolutePath), now)
}

export function wasRecentAppFileChange(absolutePath: string): boolean {
  const timestamp = recentAppFileChanges.get(path.resolve(absolutePath))

  if (timestamp === undefined) {
    return false
  }

  return Date.now() - timestamp <= RECENT_APP_CHANGE_TTL_MS
}
