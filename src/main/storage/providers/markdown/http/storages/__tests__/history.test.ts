import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpHistoryStorage } from '../history'

const mocked = vi.hoisted(() => ({ root: '', limit: 20, state: {} }))
vi.mock('../../../runtime/paths', () => ({ getVaultPath: () => mocked.root }))
vi.mock('../../runtime/paths', () => ({
  getHttpPaths: () => ({ httpRoot: mocked.root }),
}))
vi.mock('../../runtime/sync', () => ({
  getHttpRuntimeCache: () => ({ state: mocked.state }),
}))
vi.mock('../../../../../../store', () => ({
  store: { preferences: { get: () => ({ historyLimit: mocked.limit }) } },
}))

const snapshot = {
  request: {
    method: 'GET' as const,
    url: 'https://api.test',
    headers: [],
    body: '',
    truncated: false,
  },
  response: {
    status: 200,
    headers: [],
    body: 'original',
    bodyKind: 'text' as const,
    truncated: false,
  },
}
const entry = {
  requestId: 1,
  method: 'GET' as const,
  url: 'https://api.test',
  status: 200,
  durationMs: 1,
  sizeBytes: 8,
  requestedAt: 1,
  snapshot,
}

beforeEach(() => {
  mocked.root = fs.mkdtempSync(path.join(os.tmpdir(), 'http-history-'))
  mocked.limit = 10
  mocked.state = {}
})
afterEach(() => fs.removeSync(mocked.root))

describe('history retention', () => {
  it('limits each request independently and removes expired snapshot files', () => {
    const storage = createHttpHistoryStorage()
    for (let i = 0; i < 12; i++) {
      storage.appendEntry({ ...entry, requestedAt: i })
      storage.appendEntry({ ...entry, requestId: 2, requestedAt: i })
    }
    expect(storage.getEntries()).toHaveLength(20)
    expect(
      fs.readdirSync(path.join(mocked.root, '.history', '1')),
    ).toHaveLength(11)
    expect(
      fs.readdirSync(path.join(mocked.root, '.history', '2')),
    ).toHaveLength(11)
    expect(storage.getEntries().every(item => item.requestedAt >= 2)).toBe(
      true,
    )
  })
  it('loads persisted snapshots and keeps bodies out of the index', () => {
    const storage = createHttpHistoryStorage()
    const { id } = storage.appendEntry(entry)
    expect(mocked.state).not.toHaveProperty('history')
    expect(
      fs.readFileSync(
        path.join(mocked.root, '.history', '1', 'index.yaml'),
        'utf8',
      ),
    ).not.toContain('original')
    expect(createHttpHistoryStorage().getSnapshot(id)).toEqual(snapshot)
    expect(storage.getSnapshot(999)).toBeNull()
    storage.clear()
    expect(storage.getEntries()).toEqual([])
    expect(fs.existsSync(path.join(mocked.root, '.history'))).toBe(false)
  })
  it('stops recording when disabled without removing existing entries', () => {
    const storage = createHttpHistoryStorage()
    storage.appendEntry(entry)
    mocked.limit = 0
    storage.appendEntry(entry)
    expect(storage.getEntries()).toHaveLength(1)
  })
  it('returns no snapshot for an entry recorded without a response', () => {
    const storage = createHttpHistoryStorage()
    const { snapshot: _snapshot, ...metadata } = entry
    const { id } = storage.appendEntry(metadata)
    expect(storage.getSnapshot(id)).toBeNull()
    expect(storage.getEntries()).toHaveLength(1)
  })
  it('applies a smaller limit to existing history and handles missing or damaged snapshot files', () => {
    const storage = createHttpHistoryStorage()
    mocked.limit = 20
    for (let i = 0; i < 15; i++)
      storage.appendEntry({ ...entry, requestedAt: i })
    mocked.limit = 10
    const entries = storage.getEntries()
    expect(entries).toHaveLength(10)
    const latest = entries[0]
    fs.writeFileSync(
      path.join(mocked.root, '.history', '1', latest.snapshotFile!),
      '{}',
    )
    expect(storage.getSnapshot(latest.id)).toBeNull()
    fs.removeSync(
      path.join(mocked.root, '.history', '1', latest.snapshotFile!),
    )
    expect(storage.getSnapshot(latest.id)).toBeNull()
  })
})
