import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stateContentCacheByPath } from '../../../runtime/cache'
import { flushPendingStateWrites } from '../../../runtime/shared/stateWriter'
import { getHttpPaths } from '../../runtime/paths'
import { ensureHttpStateFile } from '../../runtime/state'
import { getHttpRuntimeCache, resetHttpRuntimeCache } from '../../runtime/sync'
import { createHttpRequestsStorage } from '../requests'

let tempVaultPath = ''

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
    resetHttpRuntimeCache()
    fs.removeSync(tempVaultPath)
    tempVaultPath = ''
    vi.useRealTimers()
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
    storage.updateRequest(id, { body: 'keep me', bodyType: 'raw' })

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
