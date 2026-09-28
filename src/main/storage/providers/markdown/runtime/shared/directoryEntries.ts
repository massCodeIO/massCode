import fs from 'fs-extra'

export type DirectoryEntriesCache = Map<string, string[]>

export function getCachedDirectoryEntries(
  directoryPath: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): string[] {
  if (!directoryEntriesCache) {
    return fs.readdirSync(directoryPath)
  }

  const cachedEntries = directoryEntriesCache.get(directoryPath)
  if (cachedEntries) {
    return cachedEntries
  }

  const entries = fs.readdirSync(directoryPath)
  directoryEntriesCache.set(directoryPath, [...entries])
  return entries
}

export function removeDirectoryEntryFromCache(
  directoryPath: string,
  fileName: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): void {
  if (!directoryEntriesCache) {
    return
  }

  const entries = directoryEntriesCache.get(directoryPath)
  if (!entries) {
    return
  }

  const normalizedFileName = fileName.toLowerCase()
  const nextEntries = entries.filter(
    entry => entry.toLowerCase() !== normalizedFileName,
  )

  directoryEntriesCache.set(directoryPath, nextEntries)
}

export function upsertDirectoryEntryInCache(
  directoryPath: string,
  fileName: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): void {
  if (!directoryEntriesCache) {
    return
  }

  const entries
    = directoryEntriesCache.get(directoryPath) || fs.readdirSync(directoryPath)
  const normalizedFileName = fileName.toLowerCase()
  const nextEntries = entries.filter(
    entry => entry.toLowerCase() !== normalizedFileName,
  )

  nextEntries.push(fileName)
  directoryEntriesCache.set(directoryPath, nextEntries)
}
