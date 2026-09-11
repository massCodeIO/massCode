import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyHttpCollection } from '../../../../../../../shared/httpCollection'
import { persistHttpImportResult } from '../../../../../../http/import/persist'
import { parsePostmanFiles } from '../../../../../../http/import/postman'
import { enqueueCloudDownload } from '../../../cloudDownloads'
import { stateContentCacheByPath } from '../../../runtime/cache'
import {
  getFileAvailability,
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../../../runtime/shared/cloudFiles'
import { flushPendingStateWriteByPath } from '../../../runtime/shared/stateWriter'

import { getHttpPaths } from '../../runtime/paths'
import * as stateModule from '../../runtime/state'
import { ensureHttpStateFile } from '../../runtime/state'
import { getHttpRuntimeCache, resetHttpRuntimeCache } from '../../runtime/sync'
import { createHttpFoldersStorage } from '../folders'
import { createHttpHistoryStorage } from '../history'
import { createHttpRequestsStorage } from '../requests'

vi.mock('../../../../../index', () => ({
  useHttpStorage: () => ({
    folders: createHttpFoldersStorage(),
    requests: createHttpRequestsStorage(),
  }),
}))

let tempVaultPath = ''

function makeSparsePlaceholder(absolutePath: string, size = 4096): void {
  fs.removeSync(absolutePath)
  const fd = fs.openSync(absolutePath, 'w')
  fs.ftruncateSync(fd, size)
  fs.closeSync(fd)
}

function mockMarkdownFilesAsZeroBlocks() {
  const statSync = fs.statSync.bind(fs)

  return vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
    const stats = statSync(filePath)

    if (
      typeof filePath === 'string'
      && filePath.endsWith('.md')
      && stats.size > 0
    ) {
      return Object.assign(stats, { blocks: 0 })
    }

    return stats
  })
}

vi.mock('electron-store', () => {
  class MockStore {
    private state: Record<string, unknown>

    constructor(options?: { defaults?: Record<string, unknown> }) {
      this.state = { ...(options?.defaults || {}) }
    }

    get(key?: string): unknown {
      if (!key) {
        return this.state
      }

      return key.split('.').reduce<unknown>((acc, segment) => {
        if (!acc || typeof acc !== 'object') {
          return undefined
        }

        return (acc as Record<string, unknown>)[segment]
      }, this.state)
    }

    set(key: string, value: unknown): void {
      const segments = key.split('.')
      let cursor: Record<string, unknown> = this.state

      for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index]
        const next = cursor[segment]

        if (!next || typeof next !== 'object') {
          cursor[segment] = {}
        }

        cursor = cursor[segment] as Record<string, unknown>
      }

      cursor[segments[segments.length - 1]] = value
    }
  }

  return { default: MockStore }
})

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

vi.mock('../../../../../../store', () => ({
  store: {
    preferences: {
      get: (key: string) => {
        if (key === 'storage.vaultPath') {
          return tempVaultPath
        }

        return undefined
      },
    },
  },
}))

describe('http folders storage', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'http-folders-storage-'),
    )
    resetHttpRuntimeCache()
    ensureHttpStateFile(getHttpPaths(tempVaultPath))
  })

  afterEach(() => {
    setDatalessProbeForTests(null)
    resetCloudFileExemptions()
    resetHttpRuntimeCache()
    fs.removeSync(tempVaultPath)
    tempVaultPath = ''
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('retains imported Markdown and entry descriptions after a cold cache reload', () => {
    const imported = parsePostmanFiles([
      {
        name: 'qa.json',
        content: JSON.stringify({
          info: {
            name: 'QA',
            schema: 'postman',
            description: '# Roundtrip QA',
          },
          auth: {
            type: 'apikey',
            apikey: [
              { key: 'key', value: 'X-Key' },
              { key: 'value', value: '{{token}}' },
            ],
          },
          variable: [{ key: 'token', value: 'collection-value' }],
          item: [
            {
              name: 'Folder',
              description: 'Folder **QA**.',
              item: [
                {
                  name: 'Request',
                  request: {
                    method: 'POST',
                    body: {
                      mode: 'urlencoded',
                      urlencoded: [
                        {
                          key: 'field',
                          value: 'a&b',
                          disabled: true,
                          description: 'Form description',
                        },
                      ],
                    },
                    description: 'Request **QA**.',
                    header: [
                      {
                        key: 'Accept',
                        value: 'application/json',
                        description: 'Expected format',
                      },
                    ],
                    url: {
                      raw: 'https://example.com',
                      query: [
                        {
                          key: 'search',
                          value: 'hello',
                          description: 'Search description',
                          disabled: true,
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        }),
      },
    ])
    persistHttpImportResult(imported)
    flushPendingStateWriteByPath(getHttpPaths(tempVaultPath).statePath)
    stateContentCacheByPath.delete(getHttpPaths(tempVaultPath).statePath)
    resetHttpRuntimeCache()
    const folders = createHttpFoldersStorage().getFolders()
    expect(
      folders.find(folder => folder.name === 'QA')?.collectionConfig,
    ).toMatchObject({
      documentation: '# Roundtrip QA',
      auth: { type: 'apikey', key: 'X-Key', value: '{{token}}' },
      variables: [{ key: 'token', value: 'collection-value' }],
      postResponseOrder: 'parent-first',
    })
    expect(
      folders.find(folder => folder.name === 'Folder')?.collectionConfig,
    ).toMatchObject({
      documentation: 'Folder **QA**.',
      auth: { type: 'inherit' },
    })
    const requests = createHttpRequestsStorage().getRequests({})
    const saved = createHttpRequestsStorage().getRequestById(requests[0].id)!
    expect(saved.body).toBeNull()
    expect(saved.formData).toEqual([
      {
        key: 'field',
        value: 'a&b',
        type: 'text',
        enabled: false,
        description: 'Form description',
      },
    ])
    expect(saved.description).toBe('Request **QA**.')
    expect(saved.headers[0].description).toBe('Expected format')
    expect(saved.query[0]).toMatchObject({
      description: 'Search description',
      enabled: false,
    })
  })

  it('restores history and response snapshots from disk after a cold restart', () => {
    const folders = createHttpFoldersStorage()
    const folderId = folders.createFolder({ name: 'History' }).id
    const requestId = createHttpRequestsStorage().createRequest({
      name: 'Read',
      folderId,
    }).id
    const history = createHttpHistoryStorage()
    const snapshot = {
      request: {
        method: 'GET' as const,
        url: 'https://example.test',
        headers: [],
        body: '',
        truncated: false,
      },
      response: {
        status: 201,
        headers: [],
        body: '{"saved":true}',
        bodyKind: 'json' as const,
        truncated: false,
      },
    }
    const { id } = history.appendEntry({
      requestId,
      method: 'GET',
      url: 'https://example.test',
      status: 201,
      durationMs: 1,
      sizeBytes: 14,
      requestedAt: Date.now(),
      snapshot,
    })
    const paths = getHttpPaths(tempVaultPath)
    flushPendingStateWriteByPath(paths.statePath)
    resetHttpRuntimeCache()
    stateContentCacheByPath.delete(paths.statePath)
    const reloaded = createHttpHistoryStorage()
    expect(
      reloaded.getEntries().find(entry => entry.id === id)?.requestId,
    ).toBe(requestId)
    expect(reloaded.getSnapshot(id)).toEqual(snapshot)
    expect(
      createHttpRequestsStorage().getRequestById(requestId)?.folderId,
    ).toBe(folderId)
  })

  it.each([
    [10, 20, 30, 40],
    [0, 0, 2, 2],
    [0, 1, 2, 3],
  ])(
    'reorders collections by visible position with stored indices %j',
    (...indices) => {
      const folders = createHttpFoldersStorage()
      const ids = ['Billing', 'Files', 'Playground', 'GitHub'].map(
        name => folders.createFolder({ name }).id,
      )
      const state = getHttpRuntimeCache(getHttpPaths(tempVaultPath)).state
      ids.forEach(
        (id, index) =>
          (state.folders.find(folder => folder.id === id)!.orderIndex
            = indices[index]!),
      )
      folders.updateFolder(ids[3]!, { parentId: null, orderIndex: 1 })
      expect(folders.getFoldersTree().map(folder => folder.name)).toEqual([
        'Billing',
        'GitHub',
        'Files',
        'Playground',
      ])
      folders.updateFolder(ids[3]!, { parentId: null, orderIndex: 3 })
      expect(folders.getFoldersTree().map(folder => folder.name)).toEqual([
        'Billing',
        'Files',
        'Playground',
        'GitHub',
      ])
    },
  )

  it('persists collection configuration and keeps legacy folders unchanged', () => {
    const folders = createHttpFoldersStorage()
    const root = folders.createFolder({ name: 'Collection' })
    const legacy = folders.createFolder({ name: 'Legacy' })
    const config = emptyHttpCollection()
    config.documentation = '# API documentation'
    config.version = '2.1'
    config.headers = [{ key: 'X-Collection', value: 'test' }]
    expect(
      folders.updateFolder(root.id, { collectionConfig: config }).notFound,
    ).toBe(false)
    const persisted = stateModule.loadHttpState(getHttpPaths(tempVaultPath))
    expect(
      persisted.folders.find(folder => folder.id === root.id)
        ?.collectionConfig,
    ).toEqual(config)
    expect(
      persisted.folders.find(folder => folder.id === legacy.id)
        ?.collectionConfig,
    ).toBeUndefined()
  })

  it('preserves malformed configuration across state roundtrip without treating it as defaults', () => {
    const paths = getHttpPaths(tempVaultPath)
    const folders = createHttpFoldersStorage()
    const { id } = folders.createFolder({ name: 'Synced' })
    const state = getHttpRuntimeCache(paths).state
    const raw = { version: 999, unknown: 'preserve-me', runtime: null }
    state.folders.find(folder => folder.id === id)!.collectionConfig = raw
    stateModule.saveHttpStateImmediate(paths, state)
    expect(
      stateModule
        .loadHttpState(paths)
        .folders
        .find(folder => folder.id === id)
        ?.collectionConfig,
    ).toEqual(raw)
  })

  it('persists nested settings and retains them when moving folders', () => {
    const folders = createHttpFoldersStorage()
    const root = folders.createFolder({ name: 'Collection' })
    const child = folders.createFolder({ name: 'Child', parentId: root.id })
    const other = folders.createFolder({ name: 'Other' })
    const config = emptyHttpCollection()
    config.auth = { type: 'inherit' }
    folders.updateFolder(child.id, { collectionConfig: config })
    folders.updateFolder(child.id, { parentId: other.id })
    expect(
      folders.getFolders().find(folder => folder.id === child.id),
    ).toMatchObject({
      parentId: other.id,
      collectionConfig: config,
    })
  })

  it('does not change saved configuration when its immediate write fails', () => {
    const folders = createHttpFoldersStorage()
    const root = folders.createFolder({ name: 'Collection' })
    const original = emptyHttpCollection()
    folders.updateFolder(root.id, { collectionConfig: original })
    const write = vi
      .spyOn(stateModule, 'saveHttpStateImmediate')
      .mockImplementationOnce(() => {
        throw new Error('disk full')
      })
    try {
      expect(() =>
        folders.updateFolder(root.id, {
          collectionConfig: { ...original, version: 'lost' },
        }),
      ).toThrow('disk full')
      expect(
        folders.getFolders().find(folder => folder.id === root.id)?.collectionConfig,
      ).toEqual(original)
      expect(
        stateModule
          .loadHttpState(getHttpPaths(tempVaultPath))
          .folders
          .find(folder => folder.id === root.id)
          ?.collectionConfig,
      ).toEqual(original)
    }
    finally {
      write.mockRestore()
    }
  })

  it('moves resident zero-block requests to trash when deleting a folder', () => {
    const paths = getHttpPaths(tempVaultPath)
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()

    try {
      const folders = createHttpFoldersStorage()
      const requests = createHttpRequestsStorage()
      const folder = folders.createFolder({ name: 'Resident Folder' })
      const { id } = requests.createRequest({
        folderId: folder.id,
        name: 'Resident',
      })

      expect(folders.deleteFolder(folder.id)).toEqual({ deleted: true })
      expect(() =>
        requests.updateRequest(id, { description: 'still writable' }),
      ).not.toThrow()

      const record = getHttpRuntimeCache(paths).requestById.get(id)!
      expect(record.folderId).toBeNull()
      expect(record.isDeleted).toBe(1)
      expect(
        fs.readFileSync(path.join(paths.httpRoot, record.filePath), 'utf8'),
      ).toContain('still writable')
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('deletes a folder when a later planned request source is missing', () => {
    const paths = getHttpPaths(tempVaultPath)
    const folders = createHttpFoldersStorage()
    const requests = createHttpRequestsStorage()
    const folder = folders.createFolder({ name: 'Mixed Folder' })
    const resident = requests.createRequest({
      folderId: folder.id,
      name: 'Resident',
    })
    const missing = requests.createRequest({
      folderId: folder.id,
      name: 'Missing',
    })
    const cache = getHttpRuntimeCache(paths)
    const missingRecord = cache.requestById.get(missing.id)!

    fs.removeSync(path.join(paths.httpRoot, missingRecord.filePath))

    expect(folders.deleteFolder(folder.id)).toEqual({ deleted: true })

    const residentRecord = cache.requestById.get(resident.id)!
    expect(residentRecord.filePath).toBe('Resident.md')
    expect(residentRecord.folderId).toBeNull()
    expect(residentRecord.isDeleted).toBe(1)
    expect(missingRecord.filePath).toBe('Missing.md')
    expect(missingRecord.folderId).toBeNull()
    expect(missingRecord.isDeleted).toBe(1)
    expect(fs.pathExistsSync(path.join(paths.httpRoot, 'Resident.md'))).toBe(
      true,
    )
    expect(fs.pathExistsSync(path.join(paths.httpRoot, 'Missing.md'))).toBe(
      true,
    )
    expect(
      cache.state.requests.find(item => item.id === resident.id)?.filePath,
    ).toBe('Resident.md')
    expect(
      cache.state.requests.find(item => item.id === missing.id)?.filePath,
    ).toBe('Missing.md')
    expect(folders.getFolders().some(item => item.id === folder.id)).toBe(
      false,
    )
  })

  it('reserves trash targets case-insensitively before deleting', () => {
    const paths = getHttpPaths(tempVaultPath)
    const folders = createHttpFoldersStorage()
    const requests = createHttpRequestsStorage()
    const root = folders.createFolder({ name: 'Root' })
    const upperFolder = folders.createFolder({
      name: 'Upper',
      parentId: root.id,
    })
    const lowerFolder = folders.createFolder({
      name: 'Lower',
      parentId: root.id,
    })
    const upper = requests.createRequest({
      folderId: upperFolder.id,
      name: 'Foo',
    })
    const lower = requests.createRequest({
      folderId: lowerFolder.id,
      name: 'foo',
    })

    expect(folders.deleteFolder(root.id)).toEqual({ deleted: true })

    const cache = getHttpRuntimeCache(paths)
    const upperRecord = cache.requestById.get(upper.id)!
    const lowerRecord = cache.requestById.get(lower.id)!
    expect(upperRecord.filePath).toBe('Foo.md')
    expect(lowerRecord.filePath).toBe('foo 1.md')
    expect(upperRecord.isDeleted).toBe(1)
    expect(lowerRecord.isDeleted).toBe(1)
    expect(fs.pathExistsSync(path.join(paths.httpRoot, 'Foo.md'))).toBe(true)
    expect(fs.pathExistsSync(path.join(paths.httpRoot, 'foo 1.md'))).toBe(true)
    expect(folders.getFolders().some(folder => folder.id === root.id)).toBe(
      false,
    )
  })

  it('blocks folder deletion before mutating a genuine placeholder', () => {
    const paths = getHttpPaths(tempVaultPath)
    const folders = createHttpFoldersStorage()
    const requests = createHttpRequestsStorage()
    const folder = folders.createFolder({ name: 'Cloud Folder' })
    const resident = requests.createRequest({
      folderId: folder.id,
      name: 'Resident',
    })
    const { id } = requests.createRequest({
      folderId: folder.id,
      name: 'Cloud Placeholder',
    })
    const record = getHttpRuntimeCache(paths).requestById.get(id)!
    const sourcePath = path.join(paths.httpRoot, record.filePath)

    makeSparsePlaceholder(sourcePath)
    resetCloudFileExemptions()
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()
    const moveSpy = vi.spyOn(fs, 'moveSync')
    const sourceBefore = fs.readFileSync(sourcePath)
    const residentRecord = getHttpRuntimeCache(paths).requestById.get(
      resident.id,
    )!
    const residentPath = path.join(paths.httpRoot, residentRecord.filePath)

    try {
      expect(() => folders.deleteFolder(folder.id)).toThrow(
        'CLOUD_FILE_NOT_DOWNLOADED',
      )

      expect(fs.readFileSync(sourcePath)).toEqual(sourceBefore)
      expect(fs.pathExistsSync(residentPath)).toBe(true)
      expect(moveSpy).not.toHaveBeenCalled()
      expect(folders.getFolders().some(item => item.id === folder.id)).toBe(
        true,
      )
      expect(record.folderId).toBe(folder.id)
      expect(record.isDeleted).toBe(0)
    }
    finally {
      moveSpy.mockRestore()
      statSpy.mockRestore()
    }
  })

  it('marks a verified resident only after folder rename succeeds', async () => {
    const paths = getHttpPaths(tempVaultPath)
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()

    try {
      const folders = createHttpFoldersStorage()
      const requests = createHttpRequestsStorage()
      const folder = folders.createFolder({ name: 'Before' })
      const { id } = requests.createRequest({
        folderId: folder.id,
        name: 'Resident',
      })
      const sourcePath = path.join(paths.httpRoot, 'Before/Resident.md')
      const targetPath = path.join(paths.httpRoot, 'After/Resident.md')
      const cloudFiles = await import('../../../runtime/shared/cloudFiles')
      const markAppWrittenFileAsLocal
        = cloudFiles.markAppWrittenFileAsLocal.bind(cloudFiles)
      const markSpy = vi
        .spyOn(cloudFiles, 'markAppWrittenFileAsLocal')
        .mockImplementation((absolutePath) => {
          if (absolutePath === targetPath) {
            expect(fs.pathExistsSync(sourcePath)).toBe(false)
            expect(fs.pathExistsSync(targetPath)).toBe(true)
          }
          markAppWrittenFileAsLocal(absolutePath)
        })

      try {
        expect(() =>
          folders.updateFolder(folder.id, { name: 'After' }),
        ).not.toThrow()
        expect(markSpy).toHaveBeenCalledWith(targetPath)
        expect(() =>
          requests.updateRequest(id, { description: 'still writable' }),
        ).not.toThrow()

        const record = getHttpRuntimeCache(paths).requestById.get(id)!
        expect(record.filePath).toBe('After/Resident.md')
      }
      finally {
        markSpy.mockRestore()
      }
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('moves and requeues a pending placeholder without marking it', async () => {
    const paths = getHttpPaths(tempVaultPath)
    const folders = createHttpFoldersStorage()
    const requests = createHttpRequestsStorage()
    const folder = folders.createFolder({ name: 'Before' })
    const { id } = requests.createRequest({
      folderId: folder.id,
      name: 'Cloud Placeholder',
    })
    const record = getHttpRuntimeCache(paths).requestById.get(id)!
    const sourcePath = path.join(paths.httpRoot, record.filePath)
    const targetPath = path.join(paths.httpRoot, 'After/Cloud Placeholder.md')

    makeSparsePlaceholder(sourcePath)
    record.pendingCloudDownload = true
    resetCloudFileExemptions()
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()
    const sourceBefore = fs.readFileSync(sourcePath)
    vi.mocked(enqueueCloudDownload).mockClear()
    const cloudFiles = await import('../../../runtime/shared/cloudFiles')
    const markSpy = vi.spyOn(cloudFiles, 'markAppWrittenFileAsLocal')

    try {
      expect(() =>
        folders.updateFolder(folder.id, { name: 'After' }),
      ).not.toThrow()

      expect(fs.pathExistsSync(sourcePath)).toBe(false)
      expect(fs.readFileSync(targetPath)).toEqual(sourceBefore)
      expect(getFileAvailability(targetPath).isCloudPlaceholder).toBe(true)
      expect(enqueueCloudDownload).toHaveBeenCalledWith(targetPath)
      expect(markSpy).not.toHaveBeenCalledWith(targetPath)
      expect(() =>
        requests.updateRequest(id, { description: 'must not be written' }),
      ).toThrow('CLOUD_FILE_NOT_DOWNLOADED')
    }
    finally {
      markSpy.mockRestore()
      statSpy.mockRestore()
    }
  })
})
