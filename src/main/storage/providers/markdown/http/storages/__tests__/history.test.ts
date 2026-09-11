import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { wasRecentAppFileChange } from '../../../runtime/shared/appChanges'
import * as cloudFiles from '../../../runtime/shared/cloudFiles'
import { readVaultTextFileSync } from '../../../runtime/shared/guardedRead'
import { saveHttpStateImmediate } from '../../runtime/state'
import { createHttpHistoryStorage } from '../history'

const mocked = vi.hoisted(() => ({
  root: '',
  limit: 20,
  state: {} as { history?: unknown, provisional?: boolean },
}))
vi.mock('../../runtime/state', () => ({ saveHttpStateImmediate: vi.fn() }))
vi.mock('../../../runtime/shared/guardedRead', () => ({
  readVaultTextFileSync: vi.fn((file: string) => fs.readFileSync(file, 'utf8')),
  isCloudFileNotDownloadedError: (error: unknown) =>
    error instanceof Error
    && error.message.startsWith('CLOUD_FILE_NOT_DOWNLOADED'),
}))
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
  vi.mocked(saveHttpStateImmediate).mockReset()
  vi.mocked(readVaultTextFileSync).mockImplementation(file =>
    fs.readFileSync(file, 'utf8'),
  )
})
afterEach(() => fs.removeSync(mocked.root))

describe('history retention', () => {
  it('allocates IDs across owners with frozen time, restart and external replacements', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    try {
      const storage = createHttpHistoryStorage()
      const first = storage.appendEntry(entry).id
      const second = storage.appendEntry({ ...entry, requestId: 2 }).id
      const third = storage.appendEntry({ ...entry, requestId: null }).id
      expect([first, second, third]).toEqual([1000, 1001, 1002])
      clock.mockReturnValue(500)
      expect(createHttpHistoryStorage().appendEntry(entry).id).toBe(1003)
      const index = path.join(mocked.root, '.history', '2', 'index.yaml')
      const before = fs.statSync(index)
      const replacement = fs
        .readFileSync(index, 'utf8')
        .replace('id: 1001', 'id: 9000')
      fs.writeFileSync(`${index}.external`, replacement)
      fs.utimesSync(`${index}.external`, before.atime, before.mtime)
      fs.renameSync(`${index}.external`, index)
      expect(storage.appendEntry(entry).id).toBe(9001)
    }
    finally {
      clock.mockRestore()
    }
  })

  it('does not parse unchanged neighbours for each append but detects their edits', () => {
    const storage = createHttpHistoryStorage()
    storage.appendEntry(entry)
    storage.appendEntry({ ...entry, requestId: 2 })
    storage.getEntries()
    const neighbour = path.join(mocked.root, '.history', '2', 'index.yaml')
    vi.mocked(readVaultTextFileSync).mockClear()
    storage.appendEntry(entry)
    expect(
      vi
        .mocked(readVaultTextFileSync)
        .mock.calls.some(([file]) => file === neighbour),
    ).toBe(false)
    const original = fs.readFileSync(neighbour, 'utf8')
    fs.writeFileSync(neighbour, '[broken')
    vi.mocked(readVaultTextFileSync).mockClear()
    storage.appendEntry(entry)
    expect(
      vi
        .mocked(readVaultTextFileSync)
        .mock.calls.some(([file]) => file === neighbour),
    ).toBe(true)
    expect(() => storage.appendEntry({ ...entry, requestId: 2 })).toThrow()
    expect(fs.readFileSync(neighbour, 'utf8')).toBe('[broken')
    fs.writeFileSync(neighbour, original)
    expect(storage.getEntries()).toHaveLength(4)
  })

  it('applies a reduced limit to other owners on append with warm metadata', () => {
    const storage = createHttpHistoryStorage()
    mocked.limit = 20
    for (let i = 0; i < 20; i++)
      storage.appendEntry({ ...entry, requestId: 2, requestedAt: i })
    storage.getEntries()
    mocked.limit = 10
    storage.appendEntry(entry)
    const neighbour = path.join(mocked.root, '.history', '2', 'index.yaml')
    // Inspect the file before getEntries can apply retention itself.
    expect(fs.readFileSync(neighbour, 'utf8').match(/^- /gmu)).toHaveLength(10)
  })

  it('rejects an exhausted ID range before changing the owner index', () => {
    const storage = createHttpHistoryStorage()
    storage.appendEntry(entry)
    const index = path.join(mocked.root, '.history', '1', 'index.yaml')
    const content = fs
      .readFileSync(index, 'utf8')
      .replace(/id: \d+/, `id: ${Number.MAX_SAFE_INTEGER}`)
    fs.writeFileSync(index, content)
    expect(() => storage.appendEntry(entry)).toThrow('ID range exhausted')
    expect(fs.readFileSync(index, 'utf8')).toBe(content)
  })

  it('migrates legacy metadata once, including unassigned requests, while recording is disabled', () => {
    const { snapshot: _snapshot, ...metadata } = entry
    mocked.state.history = [
      { ...metadata, id: 1 },
      { ...metadata, requestId: null, id: 2 },
    ]
    mocked.limit = 0
    const storage = createHttpHistoryStorage()
    expect(
      storage
        .getEntries()
        .map(entry => entry.id)
        .sort(),
    ).toEqual([1, 2])
    expect(mocked.state).not.toHaveProperty('history')
    expect(saveHttpStateImmediate).toHaveBeenCalledOnce()
    expect(storage.getSnapshot(1)).toBeNull()
    expect(createHttpHistoryStorage().getEntries()).toHaveLength(2)
  })

  it('retains the source after a partial migration write and retries without duplicates', () => {
    const { snapshot: _snapshot, ...metadata } = entry
    const source = [
      { ...metadata, id: 1 },
      { ...metadata, requestId: 2, id: 2 },
    ]
    mocked.state.history = source
    const rename = fs.renameSync.bind(fs)
    const failure = vi
      .spyOn(fs, 'renameSync')
      .mockImplementation((from, to) => {
        if (String(to).endsWith(`${path.sep}2${path.sep}index.yaml`))
          throw new Error('disk unavailable')
        return rename(from, to)
      })
    const storage = createHttpHistoryStorage()
    expect(storage.getEntries()).toHaveLength(1)
    expect(mocked.state.history).toBe(source)
    failure.mockRestore()
    expect(storage.getEntries()).toHaveLength(2)
    expect(mocked.state).not.toHaveProperty('history')
    expect(storage.getEntries()).toHaveLength(2)
  })

  it('defers migration for corrupt destinations and preserves invalid source values', () => {
    const { snapshot: _snapshot, ...metadata } = entry
    const source = [{ ...metadata, id: 1 }]
    mocked.state.history = source
    const folder = path.join(mocked.root, '.history', '1')
    fs.ensureDirSync(folder)
    fs.writeFileSync(path.join(folder, 'index.yaml'), '[broken')
    const storage = createHttpHistoryStorage()
    expect(storage.getEntries()).toEqual([])
    expect(mocked.state.history).toBe(source)
    expect(fs.readFileSync(path.join(folder, 'index.yaml'), 'utf8')).toBe(
      '[broken',
    )
    fs.writeFileSync(path.join(folder, 'index.yaml'), '[]')
    expect(storage.getEntries()).toHaveLength(1)
    mocked.state.history = { damaged: true }
    expect(storage.getEntries()).toHaveLength(1)
    expect(mocked.state.history).toEqual({ damaged: true })
    storage.clear()
    expect(mocked.state).not.toHaveProperty('history')
    expect(storage.getEntries()).toEqual([])
  })

  it('preserves the source on state flush failure and keeps new snapshots on retry', () => {
    const storage = createHttpHistoryStorage()
    const { id } = storage.appendEntry(entry)
    const { snapshotFile: _snapshot, ...metadata } = storage.getEntries()[0]
    mocked.state.history = [metadata]
    vi.mocked(saveHttpStateImmediate).mockImplementationOnce(() => {
      throw new Error('cloud')
    })
    expect(storage.getEntries()).toHaveLength(1)
    expect(mocked.state).toHaveProperty('history')
    expect(storage.getSnapshot(id)).toEqual(snapshot)
    expect(mocked.state).not.toHaveProperty('history')
  })

  it('retries legacy migration after a destination is hydrated without replacing it', () => {
    const { snapshot: _snapshot, ...metadata } = entry
    const source = [{ ...metadata, id: 1 }]
    mocked.state.history = source
    const index = path.join(mocked.root, '.history', '1', 'index.yaml')
    fs.ensureDirSync(path.dirname(index))
    fs.writeFileSync(index, '[]')
    vi.mocked(readVaultTextFileSync).mockImplementation((file) => {
      if (file === index)
        throw new Error('CLOUD_FILE_NOT_DOWNLOADED:pending')
      return fs.readFileSync(file, 'utf8')
    })
    const storage = createHttpHistoryStorage()
    expect(storage.getEntries()).toEqual([])
    expect(mocked.state.history).toBe(source)
    expect(fs.readFileSync(index, 'utf8')).toBe('[]')
    expect(saveHttpStateImmediate).not.toHaveBeenCalled()
    vi.mocked(readVaultTextFileSync).mockImplementation(file =>
      fs.readFileSync(file, 'utf8'),
    )
    expect(storage.getEntries().map(record => record.id)).toEqual([1])
    expect(mocked.state).not.toHaveProperty('history')
  })

  it('does not overwrite an existing entry when a legacy ID conflicts', () => {
    const storage = createHttpHistoryStorage()
    const { id } = storage.appendEntry(entry)
    mocked.state.history = [
      { ...storage.getEntries()[0], url: 'https://different.test' },
    ]
    expect(storage.getEntries()[0].url).toBe(entry.url)
    expect(mocked.state).toHaveProperty('history')
    expect(storage.getSnapshot(id)).toEqual(snapshot)
  })

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
  it.each(['[invalid yaml', '{}'])(
    'isolates damaged indices without overwriting the owner: %s',
    (damaged) => {
      const storage = createHttpHistoryStorage()
      storage.appendEntry(entry)
      const index = path.join(mocked.root, '.history', '1', 'index.yaml')
      const original = fs.readFileSync(index, 'utf8')
      fs.writeFileSync(index, damaged)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const healthy = storage.appendEntry({ ...entry, requestId: 2 })
        expect(storage.getEntries().map(item => item.requestId)).toEqual([2])
        expect(storage.getSnapshot(healthy.id)).toEqual(snapshot)
        expect(() => storage.appendEntry(entry)).toThrow()
        expect(fs.readFileSync(index, 'utf8')).toBe(damaged)
        expect(warn).toHaveBeenCalled()
        fs.writeFileSync(index, original)
        expect(storage.getEntries()).toHaveLength(2)
      }
      finally {
        warn.mockRestore()
      }
    },
  )
  it('isolates cloud indices, protects their owner and retries after hydration', () => {
    const storage = createHttpHistoryStorage()
    storage.appendEntry(entry)
    storage.getEntries()
    const index = path.join(mocked.root, '.history', '1', 'index.yaml')
    const getAvailability = cloudFiles.getFileAvailability
    const availability = vi
      .spyOn(cloudFiles, 'getFileAvailability')
      .mockImplementation((file) => {
        const result = getAvailability(file)
        return file === index
          ? { ...result, isCloudPlaceholder: true }
          : result
      })
    vi.mocked(readVaultTextFileSync).mockImplementation((file) => {
      if (file === index)
        throw new Error('CLOUD_FILE_NOT_DOWNLOADED:pending')
      return fs.readFileSync(file, 'utf8')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      vi.mocked(readVaultTextFileSync).mockClear()
      storage.appendEntry({ ...entry, requestId: 2 })
      expect(
        vi
          .mocked(readVaultTextFileSync)
          .mock.calls.some(([file]) => file === index),
      ).toBe(true)
      expect(storage.getEntries()).toHaveLength(1)
      expect(() => storage.appendEntry(entry)).toThrow(
        'CLOUD_FILE_NOT_DOWNLOADED',
      )
      vi.mocked(readVaultTextFileSync).mockImplementation(file =>
        fs.readFileSync(file, 'utf8'),
      )
      availability.mockRestore()
      expect(storage.getEntries()).toHaveLength(2)
    }
    finally {
      availability.mockRestore()
      warn.mockRestore()
    }
  })
  it('propagates unavailable snapshots and opens them after cloud hydration', () => {
    const storage = createHttpHistoryStorage()
    const { id } = storage.appendEntry(entry)
    const file = path.join(mocked.root, '.history', '1', `${id}.json`)
    vi.mocked(readVaultTextFileSync).mockImplementation((target) => {
      if (target === file)
        throw new Error('CLOUD_FILE_NOT_DOWNLOADED:pending')
      return fs.readFileSync(target, 'utf8')
    })
    expect(() => storage.getSnapshot(id)).toThrow('CLOUD_FILE_NOT_DOWNLOADED')
    vi.mocked(readVaultTextFileSync).mockImplementation(target =>
      fs.readFileSync(target, 'utf8'),
    )
    expect(storage.getSnapshot(id)).toEqual(snapshot)
  })
  it('suppresses own write, retention and clear events but accepts external changes', () => {
    const storage = createHttpHistoryStorage()
    const { id } = storage.appendEntry(entry)
    const folder = path.join(mocked.root, '.history', '1')
    const index = path.join(folder, 'index.yaml')
    const file = path.join(folder, `${id}.json`)
    expect(wasRecentAppFileChange(index)).toBe(true)
    expect(wasRecentAppFileChange(file)).toBe(true)
    fs.appendFileSync(index, '\n# external edit')
    expect(wasRecentAppFileChange(index)).toBe(false)
    for (let i = 2; i <= 11; i++)
      storage.appendEntry({ ...entry, requestedAt: i })
    expect(fs.existsSync(file)).toBe(false)
    expect(wasRecentAppFileChange(file)).toBe(true)
    const remaining = fs
      .readdirSync(folder)
      .map(name => path.join(folder, name))
    storage.clear()
    for (const removed of [...remaining, folder])
      expect(wasRecentAppFileChange(removed)).toBe(true)
  })
})
