import type {
  HttpHistoryAppendInput,
  HttpHistoryStorage,
} from '../../../../contracts'
import type { HttpHistoryRecord } from '../runtime/types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { z } from 'zod'
import {
  HTTP_HISTORY_DEFAULT_LIMIT,
  HTTP_HISTORY_LIMITS,
  httpHistorySnapshotSchema,
} from '../../../../../../shared/httpHistory'
import { store } from '../../../../../store'
import { getVaultPath } from '../../runtime/paths'
import { rememberAppFileChange } from '../../runtime/shared/appChanges'
import { getFileAvailability } from '../../runtime/shared/cloudFiles'
import {
  isCloudFileNotDownloadedError,
  readVaultTextFileSync,
} from '../../runtime/shared/guardedRead'
import { getHttpPaths } from '../runtime/paths'
import { saveHttpStateImmediate } from '../runtime/state'
import { getHttpRuntimeCache } from '../runtime/sync'

const recordSchema = z.object({
  id: z.number().int().positive().safe(),
  requestId: z.number().int().positive().safe().nullable(),
  method: httpHistorySnapshotSchema.shape.request.shape.method,
  url: z.string(),
  status: z.number().nullable(),
  durationMs: z.number(),
  sizeBytes: z.number(),
  requestedAt: z.number(),
  error: z.string().optional(),
  snapshotFile: z
    .string()
    .regex(/^[a-f0-9-]+\.json$/)
    .optional(),
})

export function createHttpHistoryStorage(): HttpHistoryStorage {
  const indexMaxima = new Map<
    string,
    { signature: string, maximum: number, count: number }
  >()
  let cachedRoot = ''

  function resolvePaths() {
    const paths = getHttpPaths(getVaultPath())
    if (paths.httpRoot !== cachedRoot) {
      indexMaxima.clear()
      cachedRoot = paths.httpRoot
    }
    return paths
  }

  function limit() {
    const value = store.preferences.get('http')?.historyLimit
    return HTTP_HISTORY_LIMITS.includes(value as 20)
      ? value
      : HTTP_HISTORY_DEFAULT_LIMIT
  }

  function directory(requestId: number | null) {
    if (
      requestId !== null
      && (!Number.isSafeInteger(requestId) || requestId < 1)
    ) {
      throw new Error('Invalid history request ID')
    }
    return path.join(
      resolvePaths().httpRoot,
      '.history',
      String(requestId ?? 'unassigned'),
    )
  }

  function snapshotPath(entry: HttpHistoryRecord) {
    if (!entry.snapshotFile || !/^[a-f0-9-]+\.json$/.test(entry.snapshotFile))
      throw new Error('Invalid history snapshot')
    return path.join(directory(entry.requestId), entry.snapshotFile)
  }

  function readIndex(requestId: number | null): HttpHistoryRecord[] {
    const file = path.join(directory(requestId), 'index.yaml')
    indexMaxima.delete(file)
    if (!fs.existsSync(file))
      return []
    const signature = indexSignature(file)
    const entries = yaml.load(readVaultTextFileSync(file))
    if (!Array.isArray(entries))
      throw new Error('Invalid history index')
    const records = entries.map(entry =>
      recordSchema.parse({ ...entry, requestId }),
    )
    if (signature) {
      indexMaxima.set(file, {
        signature,
        maximum: records.reduce(
          (maximum, entry) => Math.max(maximum, entry.id),
          0,
        ),
        count: records.length,
      })
    }
    return records
  }

  function indexSignature(file: string) {
    const { exists, isCloudPlaceholder, stats } = getFileAvailability(file)
    if (!exists || isCloudPlaceholder || !stats?.isFile())
      return null
    return [
      stats.dev,
      stats.ino,
      stats.ctimeMs,
      stats.mtimeMs,
      stats.size,
      stats.blocks,
    ].join(':')
  }

  function nextId() {
    const root = path.join(resolvePaths().httpRoot, '.history')
    let next = Date.now()
    const present = new Set<string>()
    if (fs.existsSync(root)) {
      for (const item of fs.readdirSync(root, { withFileTypes: true })) {
        if (!item.isDirectory() || !/^(?:[1-9]\d*|unassigned)$/.test(item.name))
          continue
        const file = path.join(root, item.name, 'index.yaml')
        present.add(file)
        try {
          const signature = indexSignature(file)
          if (!signature || indexMaxima.get(file)?.signature !== signature)
            readIndex(item.name === 'unassigned' ? null : Number(item.name))
          next = Math.max(next, (indexMaxima.get(file)?.maximum ?? 0) + 1)
          if ((indexMaxima.get(file)?.count ?? 0) > limit()) {
            prune(
              readIndex(
                item.name === 'unassigned' ? null : Number(item.name),
              ).sort((a, b) => b.requestedAt - a.requestedAt || b.id - a.id),
            )
          }
        }
        catch (error) {
          indexMaxima.delete(file)
          console.warn(`HTTP history index unavailable: ${item.name}`, error)
        }
      }
    }
    for (const file of indexMaxima.keys()) {
      if (!present.has(file))
        indexMaxima.delete(file)
    }
    if (!Number.isSafeInteger(next) || next < 1)
      throw new Error('HTTP history ID range exhausted')
    return next
  }

  function writeIndex(requestId: number | null, entries: HttpHistoryRecord[]) {
    const folder = directory(requestId)
    fs.ensureDirSync(folder)
    const file = path.join(folder, 'index.yaml')
    fs.writeFileSync(
      `${file}.tmp`,
      yaml.dump(entries, { noRefs: true, lineWidth: -1 }),
    )
    fs.renameSync(`${file}.tmp`, file)
    indexMaxima.delete(file)
    rememberAppFileChange(`${file}.tmp`)
    rememberAppFileChange(file)
    rememberAppFileChange(folder)
    rememberAppFileChange(path.dirname(folder))
  }

  function entries() {
    const root = path.join(resolvePaths().httpRoot, '.history')
    if (!fs.existsSync(root))
      return []
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter(
        item =>
          item.isDirectory() && /^(?:[1-9]\d*|unassigned)$/.test(item.name),
      )
      .flatMap((item) => {
        try {
          return readIndex(
            item.name === 'unassigned' ? null : Number(item.name),
          )
        }
        catch (error) {
          console.warn(`HTTP history index unavailable: ${item.name}`, error)
          return []
        }
      })
      .sort((a, b) => b.requestedAt - a.requestedAt || b.id - a.id)
  }

  function prune(records: HttpHistoryRecord[]) {
    const count = limit()
    if (!count)
      return records
    const groups = new Map<number | null, HttpHistoryRecord[]>()
    for (const entry of records) {
      const group = groups.get(entry.requestId) ?? []
      group.push(entry)
      groups.set(entry.requestId, group)
    }
    for (const [requestId, group] of groups) {
      if (group.length <= count)
        continue
      writeIndex(requestId, group.slice(0, count))
      for (const entry of group.slice(count)) {
        if (entry.snapshotFile) {
          const file = snapshotPath(entry)
          fs.removeSync(file)
          rememberAppFileChange(file)
          rememberAppFileChange(path.dirname(file))
        }
      }
    }
    return [...groups.values()]
      .flatMap(group => group.slice(0, count))
      .sort((a, b) => b.requestedAt - a.requestedAt || b.id - a.id)
  }

  function migrateLegacyHistory() {
    const paths = resolvePaths()
    const { state } = getHttpRuntimeCache(paths)
    if (state.provisional || !('history' in state))
      return
    const source = state.history
    try {
      const legacy = recordSchema
        .omit({ snapshotFile: true })
        .array()
        .parse(source)
      const existing = new Map(entries().map(entry => [entry.id, entry]))
      const groups = new Map<number | null, HttpHistoryRecord[]>()
      for (const entry of legacy) {
        let group = groups.get(entry.requestId)
        if (!group) {
          // A missing/cloud/corrupt destination is never treated as empty.
          group = readIndex(entry.requestId)
          groups.set(entry.requestId, group)
        }
        const previous = existing.get(entry.id)
        if (previous) {
          const { snapshotFile: _snapshot, ...metadata } = previous
          if (JSON.stringify(metadata) !== JSON.stringify(entry))
            throw new Error(`HTTP_HISTORY_MIGRATION_CONFLICT: ${entry.id}`)
          continue
        }
        group.push(entry)
        existing.set(entry.id, entry)
      }
      for (const [requestId, group] of groups) {
        writeIndex(
          requestId,
          group.sort((a, b) => b.requestedAt - a.requestedAt || b.id - a.id),
        )
      }
      delete state.history
      try {
        saveHttpStateImmediate(paths, state)
      }
      catch (error) {
        state.history = source
        throw error
      }
    }
    catch (error) {
      console.warn('HTTP legacy history migration deferred', error)
    }
  }

  return {
    getSnapshot(id) {
      migrateLegacyHistory()
      const entry = entries().find(item => item.id === id)
      if (!entry?.snapshotFile)
        return null
      try {
        return httpHistorySnapshotSchema.parse(
          JSON.parse(readVaultTextFileSync(snapshotPath(entry))),
        )
      }
      catch (error) {
        if (isCloudFileNotDownloadedError(error))
          throw error
        return null
      }
    },
    getEntries() {
      migrateLegacyHistory()
      return prune(entries())
    },

    appendEntry(input: HttpHistoryAppendInput) {
      migrateLegacyHistory()
      if (limit() === 0)
        return { id: 0 }
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)
      if (state.provisional)
        return { id: 0 }

      // A damaged owner index must never be replaced with a partial history.
      const ownRecords = readIndex(input.requestId)
      const id = nextId()
      const record: HttpHistoryRecord = {
        durationMs: input.durationMs,
        id,
        method: input.method,
        requestedAt: input.requestedAt,
        requestId: input.requestId,
        sizeBytes: input.sizeBytes,
        status: input.status,
        url: input.url,
      }

      if (input.error) {
        record.error = input.error
      }

      if (input.snapshot) {
        const file = `${id}.json`
        record.snapshotFile = file
        const destination = snapshotPath(record)
        fs.ensureDirSync(path.dirname(destination))
        fs.writeJsonSync(destination, input.snapshot)
        rememberAppFileChange(destination)
      }
      writeIndex(input.requestId, [record, ...ownRecords])
      prune(
        [record, ...ownRecords].sort(
          (a, b) => b.requestedAt - a.requestedAt || b.id - a.id,
        ),
      )
      return { id }
    },

    clear() {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)
      if (state.provisional)
        return
      if ('history' in state) {
        const source = state.history
        delete state.history
        try {
          saveHttpStateImmediate(paths, state)
        }
        catch (error) {
          state.history = source
          throw error
        }
      }
      const root = path.join(resolvePaths().httpRoot, '.history')
      // Unlink events are emitted for every descendant, not just the root.
      const removed: string[] = []
      function collectPaths(folder: string) {
        if (!fs.existsSync(folder))
          return
        for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
          const file = path.join(folder, item.name)
          if (item.isDirectory())
            collectPaths(file)
          removed.push(file)
        }
      }
      collectPaths(root)
      fs.removeSync(root)
      indexMaxima.clear()
      for (const file of [...removed, root]) rememberAppFileChange(file)
    },
  }
}
