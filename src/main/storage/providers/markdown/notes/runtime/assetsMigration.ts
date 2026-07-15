import type { Stats } from 'node:fs'
import type { NotesRuntimeCache } from './types'
import { createHash, randomBytes } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import {
  copyFile,
  link,
  lstat,
  open,
  readFile,
  rm,
  unlink,
} from 'node:fs/promises'
import path from 'node:path'
import fs from 'fs-extra'
import { log } from '../../../../../utils'
import {
  enqueueCloudDownload,
  prioritizeCloudDownload,
} from '../../cloudDownloads'
import { getFileAvailability } from '../../runtime/shared/cloudFiles'
import { parseNotesAssetName } from './assets'
import { ensureNoteContentLoaded } from './notes'

const NOTES_ASSET_URL_PATTERN = /masscode:\/\/notes-asset\/([^\s)<>'"]+)/g

export interface NotesAssetsMigrationSummary {
  conflicts: number
  deferred: number
  errors: number
  migrated: number
  referenced: number
  removedEqual: number
}

export interface NotesAssetReferenceDiscovery {
  complete: boolean
  fileNames: Set<string>
}

interface NotesAssetsMigrationHooks {
  afterFinalDestinationHash?: (paths: {
    destinationPath: string
    sourcePath: string
    tempPath?: string
  }) => Promise<void> | void
  afterPublish?: (paths: {
    destinationPath: string
    sourcePath: string
    tempPath: string
  }) => Promise<void> | void
  beforePublish?: (paths: {
    destinationPath: string
    sourcePath: string
    tempPath: string
  }) => Promise<void> | void
}

type MigrationOutcome =
  | 'conflict'
  | 'deferred'
  | 'migrated'
  | 'missing'
  | 'removed-equal'

let migrationGeneration = 0
let activeMigration: Promise<void> | null = null
let pendingCache: NotesRuntimeCache | null = null

function isDirectFilePath(rootPath: string, filePath: string): boolean {
  return path.dirname(filePath) === rootPath
}

async function assertDirectRegularFile(
  rootPath: string,
  filePath: string,
): Promise<Stats> {
  if (!isDirectFilePath(rootPath, filePath)) {
    throw new Error('Notes asset migration path is not direct')
  }

  const stats = await lstat(filePath)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('Notes asset migration source is not a regular file')
  }
  return stats
}

async function hashFile(filePath: string): Promise<string> {
  const data = await readFile(filePath)
  return createHash('sha256').update(data).digest('hex')
}

async function verifyAndDeleteSource(
  sourceRootPath: string,
  sourcePath: string,
  destinationPath: string,
  expectedHash: string,
  isCancelled: () => boolean,
  hooks: NotesAssetsMigrationHooks,
  tempPath?: string,
): Promise<'conflict' | 'deferred' | 'removed'> {
  const destinationStatsBefore = await assertDirectRegularFile(
    path.dirname(destinationPath),
    destinationPath,
  )
  if (tempPath) {
    const tempStats = await lstat(tempPath)
    if (
      tempStats.dev !== destinationStatsBefore.dev
      || tempStats.ino !== destinationStatsBefore.ino
    ) {
      return 'conflict'
    }
  }

  const destinationHash = await hashFile(destinationPath)
  await hooks.afterFinalDestinationHash?.({
    destinationPath,
    sourcePath,
    ...(tempPath ? { tempPath } : {}),
  })
  if (destinationHash !== expectedHash) {
    return 'conflict'
  }

  const destinationStatsAfter = await assertDirectRegularFile(
    path.dirname(destinationPath),
    destinationPath,
  )
  if (
    destinationStatsAfter.dev !== destinationStatsBefore.dev
    || destinationStatsAfter.ino !== destinationStatsBefore.ino
  ) {
    return 'conflict'
  }

  await assertDirectRegularFile(sourceRootPath, sourcePath)
  if ((await hashFile(sourcePath)) !== expectedHash) {
    return 'conflict'
  }

  if (isCancelled()) {
    return 'deferred'
  }
  await unlink(sourcePath)
  return 'removed'
}

async function removePublishedDestinationIfOwned(
  tempPath: string,
  destinationPath: string,
): Promise<void> {
  try {
    const [tempStats, destinationStats] = await Promise.all([
      lstat(tempPath),
      lstat(destinationPath),
    ])
    if (
      tempStats.dev === destinationStats.dev
      && tempStats.ino === destinationStats.ino
    ) {
      await unlink(destinationPath)
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log('storage:notes:assets-migration-cleanup', error)
    }
  }
}

async function evaluateExistingDestination(
  cache: NotesRuntimeCache,
  sourcePath: string,
  destinationPath: string,
  sourceHash: string,
  isCancelled: () => boolean,
  hooks: NotesAssetsMigrationHooks,
): Promise<MigrationOutcome | null> {
  const availability = getFileAvailability(destinationPath)
  if (!availability.exists) {
    return null
  }

  await assertDirectRegularFile(cache.paths.assetsPath, destinationPath)
  if (availability.isCloudPlaceholder) {
    prioritizeCloudDownload(destinationPath)
    return 'deferred'
  }

  const deletion = await verifyAndDeleteSource(
    cache.paths.legacyAssetsPath,
    sourcePath,
    destinationPath,
    sourceHash,
    isCancelled,
    hooks,
  )
  if (deletion === 'removed') {
    return 'removed-equal'
  }
  return deletion
}

export function discoverNotesAssetReferences(
  cache: NotesRuntimeCache,
): NotesAssetReferenceDiscovery {
  const fileNames = new Set<string>()
  let complete = true

  for (const note of cache.notes) {
    if (note.pendingCloudDownload) {
      enqueueCloudDownload(path.join(cache.paths.notesRoot, note.filePath))
      complete = false
      continue
    }

    if (note.content === null && !ensureNoteContentLoaded(cache.paths, note)) {
      complete = false
      continue
    }

    if (note.content === null) {
      complete = false
      continue
    }

    for (const match of note.content.matchAll(NOTES_ASSET_URL_PATTERN)) {
      const parsedName = parseNotesAssetName(match[1])
      if (parsedName) {
        fileNames.add(parsedName.fileName)
      }
    }
  }

  return { complete, fileNames }
}

async function migrateReferencedAsset(
  cache: NotesRuntimeCache,
  fileName: string,
  isCancelled: () => boolean,
  hooks: NotesAssetsMigrationHooks,
): Promise<MigrationOutcome> {
  if (isCancelled()) {
    return 'deferred'
  }

  const sourcePath = path.join(cache.paths.legacyAssetsPath, fileName)
  const destinationPath = path.join(cache.paths.assetsPath, fileName)
  const sourceAvailability = getFileAvailability(sourcePath)

  if (!sourceAvailability.exists) {
    return 'missing'
  }
  await assertDirectRegularFile(cache.paths.legacyAssetsPath, sourcePath)
  if (isCancelled()) {
    return 'deferred'
  }

  const destinationAvailability = getFileAvailability(destinationPath)
  if (destinationAvailability.exists) {
    await assertDirectRegularFile(cache.paths.assetsPath, destinationPath)
    if (isCancelled()) {
      return 'deferred'
    }
  }

  let shouldDeferForHydration = false
  if (sourceAvailability.isCloudPlaceholder) {
    prioritizeCloudDownload(sourcePath)
    shouldDeferForHydration = true
  }
  if (
    destinationAvailability.exists
    && destinationAvailability.isCloudPlaceholder
  ) {
    prioritizeCloudDownload(destinationPath)
    shouldDeferForHydration = true
  }
  if (shouldDeferForHydration) {
    return 'deferred'
  }

  if (destinationAvailability.exists) {
    const sourceHash = await hashFile(sourcePath)
    return (
      (await evaluateExistingDestination(
        cache,
        sourcePath,
        destinationPath,
        sourceHash,
        isCancelled,
        hooks,
      )) ?? 'deferred'
    )
  }

  const sourceHash = await hashFile(sourcePath)
  if (isCancelled()) {
    return 'deferred'
  }

  await fs.ensureDir(cache.paths.assetsPath)
  const tempPath = path.join(
    cache.paths.assetsPath,
    `.${fileName}.${randomBytes(8).toString('hex')}.migration.tmp`,
  )
  let tempCreated = false
  let shouldCleanupPublishedDestination = false

  try {
    const tempHandle = await open(
      tempPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    )
    tempCreated = true
    await tempHandle.close()

    await copyFile(sourcePath, tempPath)
    if ((await hashFile(tempPath)) !== sourceHash) {
      throw new Error('Notes asset migration temp hash mismatch')
    }

    if (isCancelled()) {
      return 'deferred'
    }

    await hooks.beforePublish?.({
      destinationPath,
      sourcePath,
      tempPath,
    })

    try {
      await link(tempPath, destinationPath)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }

      return (
        (await evaluateExistingDestination(
          cache,
          sourcePath,
          destinationPath,
          sourceHash,
          isCancelled,
          hooks,
        )) ?? 'deferred'
      )
    }

    shouldCleanupPublishedDestination = true
    await hooks.afterPublish?.({
      destinationPath,
      sourcePath,
      tempPath,
    })

    const deletion = await verifyAndDeleteSource(
      cache.paths.legacyAssetsPath,
      sourcePath,
      destinationPath,
      sourceHash,
      isCancelled,
      hooks,
      tempPath,
    )
    if (deletion === 'conflict') {
      return 'conflict'
    }
    shouldCleanupPublishedDestination = false
    return deletion === 'removed' ? 'migrated' : 'deferred'
  }
  finally {
    if (shouldCleanupPublishedDestination) {
      await removePublishedDestinationIfOwned(tempPath, destinationPath)
    }
    if (tempCreated) {
      await rm(tempPath, { force: true })
    }
  }
}

async function runNotesAssetsMigrationInternal(
  cache: NotesRuntimeCache,
  isCancelled: () => boolean,
  hooks: NotesAssetsMigrationHooks,
): Promise<NotesAssetsMigrationSummary> {
  const discovery = discoverNotesAssetReferences(cache)
  const summary: NotesAssetsMigrationSummary = {
    conflicts: 0,
    deferred: discovery.complete ? 0 : 1,
    errors: 0,
    migrated: 0,
    referenced: discovery.fileNames.size,
    removedEqual: 0,
  }

  for (const fileName of discovery.fileNames) {
    if (isCancelled()) {
      summary.deferred += 1
      break
    }

    try {
      const outcome = await migrateReferencedAsset(
        cache,
        fileName,
        isCancelled,
        hooks,
      )
      if (outcome === 'conflict') {
        summary.conflicts += 1
      }
      else if (outcome === 'deferred') {
        summary.deferred += 1
      }
      else if (outcome === 'migrated') {
        summary.migrated += 1
      }
      else if (outcome === 'removed-equal') {
        summary.removedEqual += 1
      }
    }
    catch (error) {
      summary.errors += 1
      log('storage:notes:assets-migration-item', error)
    }
  }

  return summary
}

export async function runNotesAssetsMigration(
  cache: NotesRuntimeCache,
  isCancelled: () => boolean = () => false,
): Promise<NotesAssetsMigrationSummary> {
  return runNotesAssetsMigrationInternal(cache, isCancelled, {})
}

// Test-only fault injection entrypoint; intentionally omitted from runtime/index.
export async function runNotesAssetsMigrationForTests(
  cache: NotesRuntimeCache,
  isCancelled: () => boolean = () => false,
  hooks: NotesAssetsMigrationHooks = {},
): Promise<NotesAssetsMigrationSummary> {
  return runNotesAssetsMigrationInternal(cache, isCancelled, hooks)
}

export function scheduleNotesAssetsMigration(cache: NotesRuntimeCache): void {
  pendingCache = cache
  if (activeMigration) {
    return
  }

  const generation = migrationGeneration
  const drain = async (): Promise<void> => {
    while (pendingCache) {
      if (generation !== migrationGeneration) {
        break
      }
      const nextCache = pendingCache
      pendingCache = null
      await runNotesAssetsMigration(
        nextCache,
        () => generation !== migrationGeneration,
      )
    }
  }

  activeMigration = drain()
    .catch(error => log('storage:notes:assets-migration', error))
    .finally(() => {
      activeMigration = null
      if (pendingCache) {
        scheduleNotesAssetsMigration(pendingCache)
      }
    })
}

export function cancelNotesAssetsMigration(): void {
  migrationGeneration += 1
  pendingCache = null
}

export async function waitForNotesAssetsMigrationForTests(): Promise<void> {
  await activeMigration
}
