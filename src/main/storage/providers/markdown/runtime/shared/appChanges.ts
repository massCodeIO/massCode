import path from 'node:path'
import fs from 'fs-extra'

// Own file mutations are remembered briefly so the vault watcher can skip
// re-syncing echoes of the app's own writes: the runtime caches are already
// updated synchronously by the storage layer before files hit the disk.
//
// The entry keeps the file signature (mtime + size) captured right after the
// app's own fs operation: an external edit of the same file inside the TTL
// window changes the signature, so it is re-synced instead of being treated
// as an echo.
const RECENT_APP_CHANGE_TTL_MS = 2500

interface RecentAppFileChange {
  timestamp: number
  // null — файла нет на диске (собственное удаление/перемещение)
  signature: string | null
}

const recentAppFileChanges = new Map<string, RecentAppFileChange>()

function getFileSignature(absolutePath: string): string | null {
  try {
    const stats = fs.statSync(absolutePath)
    return `${stats.mtimeMs}:${stats.size}`
  }
  catch {
    return null
  }
}

// Должен вызываться сразу ПОСЛЕ собственной fs-операции, чтобы сигнатура
// соответствовала состоянию, которое оставило приложение.
export function rememberAppFileChange(absolutePath: string): void {
  const now = Date.now()

  for (const [knownPath, entry] of recentAppFileChanges) {
    if (now - entry.timestamp > RECENT_APP_CHANGE_TTL_MS) {
      recentAppFileChanges.delete(knownPath)
    }
  }

  const resolvedPath = path.resolve(absolutePath)
  recentAppFileChanges.set(resolvedPath, {
    signature: getFileSignature(resolvedPath),
    timestamp: now,
  })
}

export function wasRecentAppFileChange(absolutePath: string): boolean {
  const resolvedPath = path.resolve(absolutePath)
  const entry = recentAppFileChanges.get(resolvedPath)

  if (entry === undefined) {
    return false
  }

  if (Date.now() - entry.timestamp > RECENT_APP_CHANGE_TTL_MS) {
    recentAppFileChanges.delete(resolvedPath)
    return false
  }

  // Файл изменился после нашей записи — это внешняя правка, а не эхо.
  if (getFileSignature(resolvedPath) !== entry.signature) {
    recentAppFileChanges.delete(resolvedPath)
    return false
  }

  return true
}
