import path from 'node:path'
import fs from 'fs-extra'
import { rememberAppFileChange } from './appChanges'

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

// Откат move из persist*, когда запись frontmatter по новому пути упала:
// иначе файл со старым frontmatter остался бы в новом месте. false значит,
// что вернуть файл не удалось, и он по-прежнему лежит по новому пути.
export function tryMoveFileBack(
  movedAbsolutePath: string,
  originalAbsolutePath: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): boolean {
  try {
    fs.moveSync(movedAbsolutePath, originalAbsolutePath, { overwrite: false })
  }
  catch {
    return false
  }

  rememberAppFileChange(movedAbsolutePath)
  rememberAppFileChange(originalAbsolutePath)
  upsertDirectoryEntryInCache(
    path.dirname(originalAbsolutePath),
    path.basename(originalAbsolutePath),
    directoryEntriesCache,
  )

  return true
}
