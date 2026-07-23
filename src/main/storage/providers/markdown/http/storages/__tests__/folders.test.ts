import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enqueueCloudDownload } from '../../../cloudDownloads'
import {
  getFileAvailability,
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../../../runtime/shared/cloudFiles'
import { getHttpPaths } from '../../runtime/paths'
import { ensureHttpStateFile } from '../../runtime/state'
import { getHttpRuntimeCache, resetHttpRuntimeCache } from '../../runtime/sync'
import { createHttpFoldersStorage } from '../folders'
import { createHttpRequestsStorage } from '../requests'

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
