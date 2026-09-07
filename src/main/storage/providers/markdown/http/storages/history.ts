import type {
  HttpHistoryAppendInput,
  HttpHistoryStorage,
} from '../../../../contracts'
import type { HttpHistoryRecord } from '../runtime/types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import {
  HTTP_HISTORY_DEFAULT_LIMIT,
  HTTP_HISTORY_LIMITS,
  httpHistorySnapshotSchema,
} from '../../../../../../shared/httpHistory'
import { store } from '../../../../../store'
import { getVaultPath } from '../../runtime/paths'
import { readVaultTextFileSync } from '../../runtime/shared/guardedRead'
import { getHttpPaths } from '../runtime/paths'
import { getHttpRuntimeCache } from '../runtime/sync'

export function createHttpHistoryStorage(): HttpHistoryStorage {
  function resolvePaths() {
    return getHttpPaths(getVaultPath())
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
    if (!fs.existsSync(file))
      return []
    const entries = yaml.load(readVaultTextFileSync(file))
    if (!Array.isArray(entries))
      throw new Error('Invalid history index')
    return entries.map(entry => ({ ...entry, requestId }))
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
      .flatMap(item =>
        readIndex(item.name === 'unassigned' ? null : Number(item.name)),
      )
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
        if (entry.snapshotFile)
          fs.removeSync(snapshotPath(entry))
      }
    }
    return [...groups.values()]
      .flatMap(group => group.slice(0, count))
      .sort((a, b) => b.requestedAt - a.requestedAt || b.id - a.id)
  }

  return {
    getSnapshot(id) {
      const entry = entries().find(item => item.id === id)
      if (!entry?.snapshotFile)
        return null
      try {
        return httpHistorySnapshotSchema.parse(
          fs.readJsonSync(snapshotPath(entry)),
        )
      }
      catch {
        return null
      }
    },
    getEntries() {
      return prune(entries())
    },

    appendEntry(input: HttpHistoryAppendInput) {
      if (limit() === 0)
        return { id: 0 }
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)
      if (state.provisional)
        return { id: 0 }

      const records = entries()
      const id = records.reduce(
        (next, entry) => Math.max(next, entry.id + 1),
        Date.now(),
      )
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
      }
      writeIndex(input.requestId, [
        record,
        ...records.filter(entry => entry.requestId === input.requestId),
      ])
      prune(
        [record, ...records].sort(
          (a, b) => b.requestedAt - a.requestedAt || b.id - a.id,
        ),
      )
      return { id }
    },

    clear() {
      if (getHttpRuntimeCache(resolvePaths()).state.provisional)
        return
      fs.removeSync(path.join(resolvePaths().httpRoot, '.history'))
    },
  }
}
