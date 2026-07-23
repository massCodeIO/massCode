import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stateContentCacheByPath } from '../../../runtime/cache'
import {
  getFileAvailability,
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../../../runtime/shared/cloudFiles'
import { flushPendingStateWrites } from '../../../runtime/shared/stateWriter'
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

describe('http requests storage', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'http-requests-storage-'),
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

  it('updates and renames an app-written resident zero-block request', () => {
    const paths = getHttpPaths(tempVaultPath)
    setDatalessProbeForTests((_absolutePath, stats) => stats.size === 4096)
    const statSpy = mockMarkdownFilesAsZeroBlocks()

    try {
      const storage = createHttpRequestsStorage()
      const { id } = storage.createRequest({ name: 'Resident' })
      const sourcePath = path.join(paths.httpRoot, 'Resident.md')

      expect(() =>
        storage.updateRequest(id, {
          body: 'resident body',
          bodyType: 'text',
        }),
      ).not.toThrow()
      const sourceIdentity = fs.lstatSync(sourcePath, { bigint: true })
      expect(() =>
        storage.updateRequest(id, { name: 'Resident Renamed' }),
      ).not.toThrow()

      const targetPath = path.join(paths.httpRoot, 'Resident Renamed.md')
      const targetIdentity = fs.lstatSync(targetPath, { bigint: true })
      expect(targetIdentity.dev).toBe(sourceIdentity.dev)
      expect(targetIdentity.ino).toBe(sourceIdentity.ino)
      expect(fs.readFileSync(targetPath, 'utf8')).toContain('resident body')
      expect(getFileAvailability(targetPath).isCloudPlaceholder).toBe(false)
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('does not mark a trusted move when destination read fails', async () => {
    const paths = getHttpPaths(tempVaultPath)
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Read Source' })
    const targetPath = path.join(paths.httpRoot, 'Read Target.md')
    const cloudFiles = await import('../../../runtime/shared/cloudFiles')
    const markSpy = vi.spyOn(cloudFiles, 'markAppWrittenFileAsLocal')
    const readFileSync = fs.readFileSync.bind(fs)
    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockImplementation(
        (filePath, options?: Parameters<typeof fs.readFileSync>[1]) => {
          if (filePath === targetPath) {
            throw new Error('trusted destination read failed')
          }
          return readFileSync(filePath, options as never) as never
        },
      )

    try {
      expect(() => storage.updateRequest(id, { name: 'Read Target' })).toThrow(
        'trusted destination read failed',
      )
      expect(markSpy).not.toHaveBeenCalled()
      expect(fs.pathExistsSync(targetPath)).toBe(true)
    }
    finally {
      readSpy.mockRestore()
      markSpy.mockRestore()
      statSpy.mockRestore()
    }
  })

  it('does not mark a trusted move when destination write fails', async () => {
    const paths = getHttpPaths(tempVaultPath)
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Write Source' })
    const targetPath = path.join(paths.httpRoot, 'Write Target.md')
    const cloudFiles = await import('../../../runtime/shared/cloudFiles')
    const markSpy = vi.spyOn(cloudFiles, 'markAppWrittenFileAsLocal')
    const writeFileSync = fs.writeFileSync.bind(fs)
    const writeSpy = vi
      .spyOn(fs, 'writeFileSync')
      .mockImplementation((filePath, data, options?) => {
        if (filePath === targetPath) {
          throw new Error('trusted destination write failed')
        }
        return writeFileSync(filePath, data, options as never)
      })

    try {
      expect(() => storage.updateRequest(id, { name: 'Write Target' })).toThrow(
        'trusted destination write failed',
      )
      expect(markSpy).not.toHaveBeenCalled()
      expect(fs.pathExistsSync(targetPath)).toBe(true)
    }
    finally {
      writeSpy.mockRestore()
      markSpy.mockRestore()
      statSpy.mockRestore()
    }
  })

  it('keeps a genuine placeholder unchanged when update or rename is attempted', () => {
    const paths = getHttpPaths(tempVaultPath)
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Cloud Placeholder' })
    const record = getHttpRuntimeCache(paths).requestById.get(id)!
    const sourcePath = path.join(paths.httpRoot, record.filePath)
    const targetPath = path.join(paths.httpRoot, 'Renamed Placeholder.md')

    makeSparsePlaceholder(sourcePath)
    resetCloudFileExemptions()
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()
    const sourceBefore = fs.readFileSync(sourcePath)

    try {
      expect(() =>
        storage.updateRequest(id, { description: 'must not be written' }),
      ).toThrow('CLOUD_FILE_NOT_DOWNLOADED')
      expect(() =>
        storage.updateRequest(id, { name: 'Renamed Placeholder' }),
      ).toThrow('CLOUD_FILE_NOT_DOWNLOADED')

      expect(fs.readFileSync(sourcePath)).toEqual(sourceBefore)
      expect(fs.pathExistsSync(targetPath)).toBe(false)
      expect(storage.getRequests().find(item => item.id === id)?.name).toBe(
        'Cloud Placeholder',
      )
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('creates the resolved target when a rename source is missing', () => {
    const paths = getHttpPaths(tempVaultPath)
    const folders = createHttpFoldersStorage()
    const storage = createHttpRequestsStorage()
    const folder = folders.createFolder({ name: 'Target Folder' })
    const { id } = storage.createRequest({ name: 'Missing Source' })
    const record = getHttpRuntimeCache(paths).requestById.get(id)!
    const sourcePath = path.join(paths.httpRoot, record.filePath)
    const expectedFilePath = 'Target Folder/Missing Renamed.md'
    const targetPath = path.join(paths.httpRoot, expectedFilePath)

    fs.removeSync(sourcePath)

    expect(() =>
      storage.updateRequest(id, {
        folderId: folder.id,
        name: 'Missing Renamed',
      }),
    ).not.toThrow()

    const cache = getHttpRuntimeCache(paths)
    const updated = cache.requestById.get(id)!
    const indexEntry = cache.state.requests.find(item => item.id === id)
    expect(fs.pathExistsSync(sourcePath)).toBe(false)
    expect(fs.pathExistsSync(targetPath)).toBe(true)
    expect(updated.name).toBe('Missing Renamed')
    expect(updated.folderId).toBe(folder.id)
    expect(updated.filePath).toBe(expectedFilePath)
    expect(indexEntry?.filePath).toBe(expectedFilePath)
  })

  it('does not move a source that appears after missing-source preflight', () => {
    const paths = getHttpPaths(tempVaultPath)
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Late Source' })
    const cache = getHttpRuntimeCache(paths)
    const record = cache.requestById.get(id)!
    const indexEntry = cache.state.requests.find(item => item.id === id)!
    const sourcePath = path.join(paths.httpRoot, record.filePath)
    const targetPath = path.join(paths.httpRoot, 'Must Not Move.md')
    const originalPath = record.filePath
    const recordBefore = { ...record }
    const pathExistsSync = fs.pathExistsSync.bind(fs)
    let injected = false

    fs.removeSync(sourcePath)
    const existsSpy = vi
      .spyOn(fs, 'pathExistsSync')
      .mockImplementation((filePath) => {
        if (!injected && filePath === sourcePath) {
          injected = true
          fs.writeFileSync(sourcePath, 'late source', 'utf8')
          return true
        }
        return pathExistsSync(filePath)
      })

    try {
      expect(() =>
        storage.updateRequest(id, { name: 'Must Not Move' }),
      ).toThrow(
        'REQUEST_FILE_MOVE_FAILED:source appeared after missing-source preflight',
      )

      expect(fs.readFileSync(sourcePath, 'utf8')).toBe('late source')
      expect(fs.pathExistsSync(targetPath)).toBe(false)
      expect(record).toEqual(recordBefore)
      expect(indexEntry.filePath).toBe(originalPath)
    }
    finally {
      existsSpy.mockRestore()
    }
  })

  it('keeps record and index unchanged when a missing-source target appears', () => {
    const paths = getHttpPaths(tempVaultPath)
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Late Target Source' })
    const cache = getHttpRuntimeCache(paths)
    const record = cache.requestById.get(id)!
    const indexEntry = cache.state.requests.find(item => item.id === id)!
    const sourcePath = path.join(paths.httpRoot, record.filePath)
    const targetPath = path.join(paths.httpRoot, 'Late Target.md')
    const originalPath = record.filePath
    const recordBefore = { ...record }
    const pathExistsSync = fs.pathExistsSync.bind(fs)
    let targetChecks = 0

    fs.removeSync(sourcePath)
    const existsSpy = vi
      .spyOn(fs, 'pathExistsSync')
      .mockImplementation((filePath) => {
        if (filePath === targetPath) {
          targetChecks += 1
          if (targetChecks === 2) {
            fs.writeFileSync(targetPath, 'late target', 'utf8')
            return true
          }
        }
        return pathExistsSync(filePath)
      })

    try {
      expect(() => storage.updateRequest(id, { name: 'Late Target' })).toThrow(
        'REQUEST_FILE_MOVE_FAILED:target appeared after missing-source preflight',
      )

      expect(fs.pathExistsSync(sourcePath)).toBe(false)
      expect(fs.readFileSync(targetPath, 'utf8')).toBe('late target')
      expect(record).toEqual(recordBefore)
      expect(indexEntry.filePath).toBe(originalPath)
    }
    finally {
      existsSpy.mockRestore()
    }
  })

  // Два ресинка: первый скан дозаполняет индекс метаданных, второй строит
  // ленивые записи из индекса без чтения body/description.
  function resyncTwiceForLazyRequests() {
    resetHttpRuntimeCache()
    getHttpRuntimeCache(getHttpPaths(tempVaultPath))
    resetHttpRuntimeCache()
    return getHttpRuntimeCache(getHttpPaths(tempVaultPath))
  }

  it('materializes lazy body and description on getRequestById', () => {
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Lazy Read' })
    storage.updateRequest(id, {
      body: '{"payload":true}',
      bodyType: 'json',
      description: 'request docs',
    })

    const cache = resyncTwiceForLazyRequests()
    const lazyRecord = cache.requestById.get(id)
    expect(lazyRecord?.detailsPending).toBe(true)
    expect(lazyRecord?.body).toBeNull()
    expect(lazyRecord?.bodyType).toBe('json')

    const record = storage.getRequestById(id)
    expect(record?.body).toBe('{"payload":true}')
    expect(record?.description).toBe('request docs')
    expect(record?.detailsPending).toBeUndefined()
  })

  it('keeps request details lazy in list results', () => {
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'List Read' })
    storage.updateRequest(id, { body: 'list-body', bodyType: 'json' })

    resyncTwiceForLazyRequests()

    // Список не требует body/description: записи остаются ленивыми, роут
    // срезает эти поля из ответа.
    const listed = storage.getRequests()
    const record = listed.find(request => request.id === id)
    expect(record?.detailsPending).toBe(true)
    expect(record?.body).toBeNull()
  })

  it('builds untouched requests from the index without reading files', () => {
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Frozen' })
    storage.updateRequest(id, { url: 'https://example.com' })

    resyncTwiceForLazyRequests()

    // Имя в файле меняется, но сигнатура индекса совпадает со stat: если
    // повторный скан отдаёт старое имя, файл действительно не читался.
    // Правка state.yaml имитирует внешнее изменение при выключенном
    // приложении: pending-запись сбрасывается, кэш содержимого чистится.
    const paths = getHttpPaths(tempVaultPath)
    const cacheBefore = getHttpRuntimeCache(paths)
    const filePath = cacheBefore.requestById.get(id)!.filePath
    const absolutePath = path.join(paths.httpRoot, filePath)
    fs.writeFileSync(
      absolutePath,
      fs.readFileSync(absolutePath, 'utf8').replace('Frozen', 'Hacked'),
      'utf8',
    )

    flushPendingStateWrites()
    const stats = fs.statSync(absolutePath)
    const persisted = yaml.load(fs.readFileSync(paths.statePath, 'utf8')) as {
      requests: { meta?: { mtimeMs: number, size: number } }[]
    }
    persisted.requests[0].meta!.mtimeMs = stats.mtimeMs
    persisted.requests[0].meta!.size = stats.size
    fs.writeFileSync(paths.statePath, yaml.dump(persisted), 'utf8')
    stateContentCacheByPath.delete(paths.statePath)

    resetHttpRuntimeCache()
    const cache = getHttpRuntimeCache(paths)
    const record = cache.requestById.get(id)

    expect(record?.name).toBe('Frozen')
    expect(record?.detailsPending).toBe(true)
  })

  it('lists cloud placeholder requests from index metadata', () => {
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Offloaded' })
    storage.updateRequest(id, { url: 'https://example.com' })

    resyncTwiceForLazyRequests()

    // Провайдер «выгрузил» файл: содержимое заменяется sparse-плейсхолдером
    // (size > 0, blocks 0), точная проверка dataless подменяется.
    const paths = getHttpPaths(tempVaultPath)
    const filePath = getHttpRuntimeCache(paths).requestById.get(id)!.filePath
    const absolutePath = path.join(paths.httpRoot, filePath)
    fs.removeSync(absolutePath)
    const fd = fs.openSync(absolutePath, 'w')
    fs.ftruncateSync(fd, 4096)
    fs.closeSync(fd)

    const stats = fs.statSync(absolutePath)
    if (stats.size === 0 || stats.blocks !== 0) {
      // На ФС без поддержки sparse-файлов сценарий невоспроизводим.
      return
    }
    setDatalessProbeForTests(() => true)

    resetHttpRuntimeCache()
    const listed = createHttpRequestsStorage().getRequests()
    const record = listed.find(request => request.id === id)

    // Недокачанный запрос виден в списке по метаданным индекса.
    expect(record?.pendingCloudDownload).toBe(true)
    expect(record?.name).toBe('Offloaded')
    expect(record?.url).toBe('https://example.com')
  })

  it('re-reads the file when index metadata misses bodyType', () => {
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'No BodyType' })
    storage.updateRequest(id, { body: '{"x":1}', bodyType: 'json' })

    resyncTwiceForLazyRequests()

    // Внешне правленный .state.yaml потерял bodyType: битая meta не должна
    // ронять список — валидатор бракует запись, файл перечитывается.
    flushPendingStateWrites()
    const paths = getHttpPaths(tempVaultPath)
    const persisted = yaml.load(fs.readFileSync(paths.statePath, 'utf8')) as {
      requests: { meta?: { bodyType?: string } }[]
    }
    delete persisted.requests[0].meta!.bodyType
    fs.writeFileSync(paths.statePath, yaml.dump(persisted), 'utf8')
    stateContentCacheByPath.delete(paths.statePath)

    resetHttpRuntimeCache()
    const listed = createHttpRequestsStorage().getRequests()
    const record = listed.find(request => request.id === id)

    expect(record?.bodyType).toBe('json')
  })

  it('rejects updates when lazy details are unavailable', () => {
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Vanishing' })
    storage.updateRequest(id, { body: 'data', bodyType: 'json' })

    resyncTwiceForLazyRequests()

    // Файл недоступен: «принятая» правка молча потерялась бы при следующем
    // ресинке, поэтому мутация отклоняется до изменения кэша.
    const paths = getHttpPaths(tempVaultPath)
    const record = getHttpRuntimeCache(paths).requestById.get(id)!
    fs.removeSync(path.join(paths.httpRoot, record.filePath))

    expect(() => storage.updateRequest(id, { name: 'Renamed' })).toThrow(
      'CLOUD_FILE_NOT_DOWNLOADED',
    )
    expect(record.name).toBe('Vanishing')
  })

  it('keeps body intact when renaming a lazy request', () => {
    const storage = createHttpRequestsStorage()
    const { id } = storage.createRequest({ name: 'Lazy Rename' })
    storage.updateRequest(id, { body: 'keep me', bodyType: 'text' })

    resyncTwiceForLazyRequests()

    // Переименование сериализует запрос целиком: незагруженные body и
    // description должны дочитаться, а не затереться пустыми.
    storage.updateRequest(id, { name: 'Lazy Renamed' })

    const record = storage.getRequestById(id)
    expect(record?.body).toBe('keep me')

    const paths = getHttpPaths(tempVaultPath)
    const rawSource = fs.readFileSync(
      path.join(paths.httpRoot, record!.filePath),
      'utf8',
    )
    expect(rawSource).toContain('keep me')
  })

  it('sorts requests by name and updated date', () => {
    vi.useFakeTimers()

    const storage = createHttpRequestsStorage()

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const bravo = storage.createRequest({ name: 'Bravo' })

    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))
    const alpha = storage.createRequest({ name: 'Alpha' })

    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'))
    storage.updateRequest(bravo.id, { description: 'Updated' })

    expect(
      storage
        .getRequests({ sort: 'name', order: 'ASC' })
        .map(request => request.id),
    ).toEqual([alpha.id, bravo.id])
    expect(
      storage
        .getRequests({ sort: 'updatedAt', order: 'DESC' })
        .map(request => request.id),
    ).toEqual([bravo.id, alpha.id])
  })

  it('keeps URL search and searchNameOnly behavior while sorting', () => {
    const storage = createHttpRequestsStorage()

    const urlMatch = storage.createRequest({
      name: 'Bravo',
      url: 'https://example.com/target',
    })
    storage.createRequest({
      name: 'Alpha',
      url: 'https://example.com/other',
    })
    const nameMatch = storage.createRequest({
      name: 'Target Request',
      url: 'https://example.com/other-target',
    })

    expect(
      storage
        .getRequests({ search: 'target', sort: 'name', order: 'ASC' })
        .map(request => request.id),
    ).toEqual([urlMatch.id, nameMatch.id])
    expect(
      storage
        .getRequests({
          search: 'target',
          searchNameOnly: 1,
          sort: 'name',
          order: 'ASC',
        })
        .map(request => request.id),
    ).toEqual([nameMatch.id])
  })
})
