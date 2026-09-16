import os from 'node:os'
import path from 'node:path'
import { setImmediate } from 'node:timers'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as cloudDownloads from '../../cloudDownloads'

import { getRuntimeCache, writeSnippetToFile } from '../../runtime'
import { getPaths } from '../../runtime/paths'
import { updateRuntimeSearchIndex } from '../../runtime/search'
import { ensureStateFile } from '../../runtime/state'
import { resetRuntimeCache, syncSnippetFileWithDisk } from '../../runtime/sync'
import { createFoldersStorage } from '../folders'
import { createSnippetsStorage } from '../snippets'

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
  BrowserWindow: {
    getFocusedWindow: () => null,
  },
  app: {
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../../../../../store', () => ({
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

describe('code snippets storage validations', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'code-snippets-storage-'),
    )
    resetRuntimeCache()
    ensureStateFile(getPaths(tempVaultPath))
  })

  afterEach(() => {
    resetRuntimeCache()

    if (tempVaultPath) {
      fs.removeSync(tempVaultPath)
    }
  })

  it('updateSnippet with empty patch returns invalidInput', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Test Snippet' })
    const result = storage.updateSnippet(id, {})

    expect(result).toEqual({ invalidInput: true, notFound: false })
  })

  it('createSnippet with bad folderId throws FOLDER_NOT_FOUND', () => {
    const storage = createSnippetsStorage()

    expect(() =>
      storage.createSnippet({ folderId: 99999, name: 'Invalid Snippet' }),
    ).toThrow('FOLDER_NOT_FOUND')
  })

  it('createSnippet without folderId succeeds', () => {
    const storage = createSnippetsStorage()
    const result = storage.createSnippet({ name: 'Normal Snippet' })

    expect(result.id).toBeGreaterThan(0)
  })

  // Два ресинка: первый скан дозаполняет индекс метаданных, второй строит
  // ленивые записи из индекса без чтения тел.
  function resyncTwiceForLazySnippets() {
    resetRuntimeCache()
    getRuntimeCache(getPaths(tempVaultPath))
    resetRuntimeCache()
    return getRuntimeCache(getPaths(tempVaultPath))
  }

  it('does not hydrate bodies for a whitespace-only async query', async () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Target' })
    storage.createSnippetContent(id, {
      label: 'Body',
      language: 'text',
      value: 'bodytoken',
    })
    const cache = resyncTwiceForLazySnippets()
    const index = cache.searchIndex
    expect(cache.snippets[0].contents[0].value).toBeNull()
    expect(
      (await storage.getSnippetsAsync!({ search: '  \n ' })).map(
        item => item.id,
      ),
    ).toEqual([id])
    expect(cache.snippets[0].contents[0].value).toBeNull()
    expect(cache.searchIndex).toBe(index)
  })

  it('matches synchronous filtering and sorting through asynchronous cold search', async () => {
    const storage = createSnippetsStorage()
    for (const [name, body] of [
      ['Alpha', 'Café bodytoken'],
      ['Beta', 'bodytoken different'],
      ['Gamma', 'unrelated'],
    ]) {
      const { id } = storage.createSnippet({ name })
      storage.createSnippetContent(id, {
        label: 'Body',
        language: 'text',
        value: body,
      })
    }
    resyncTwiceForLazySnippets()
    for (const query of [
      { search: 'bodytoken', sort: 'name' as const, order: 'ASC' as const },
      { search: 'cafe' },
      { search: 'notfound' },
      { search: 'a', searchNameOnly: 1 },
      { search: 'bodytoken', isFavorites: 1 },
      { search: 'bodytoken', isDeleted: 1 },
      { search: '' },
      { search: ' \n ' },
    ]) {
      expect(await storage.getSnippetsAsync!(query)).toEqual(
        storage.getSnippets(query),
      )
    }
  })

  it('keeps unavailable bodies partial without repeating failed reads at the end', async () => {
    const storage = createSnippetsStorage()
    for (const [name, body] of [
      ['Resident', 'bodytoken'],
      ['Unavailable', 'hiddenbody'],
      ['Failure', 'failedbody'],
    ]) {
      const { id } = storage.createSnippet({ name })
      storage.createSnippetContent(id, {
        label: 'Body',
        language: 'text',
        value: body,
      })
    }
    const cache = resyncTwiceForLazySnippets()
    const pending = cache.snippets.find(item => item.name === 'Unavailable')!
    pending.pendingCloudDownload = true
    const failed = cache.snippets.find(item => item.name === 'Failure')!
    const failedPath = path.join(cache.paths.vaultPath, failed.filePath)
    const pendingPath = path.join(cache.paths.vaultPath, pending.filePath)
    const enqueue = vi
      .spyOn(cloudDownloads, 'enqueueCloudDownload')
      .mockImplementation(() => {})
    const read = fs.readFileSync.bind(fs)
    let failures = 0
    let pendingReads = 0
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(((
      file: string,
      ...args: any[]
    ) => {
      if (file === failedPath) {
        failures++
        throw new Error('simulated read failure')
      }
      if (file === pendingPath)
        pendingReads++
      return (read as any)(file, ...args)
    }) as typeof fs.readFileSync)
    const syncGetter = vi.spyOn(storage, 'getSnippets')
    try {
      const result = await storage.getSnippetsAsync!({ search: 'bodytoken' })
      expect(result.map(item => item.name)).toEqual(['Resident'])
      expect(syncGetter).not.toHaveBeenCalled()
      expect(failures).toBe(1)
      expect(enqueue).toHaveBeenCalledWith(failedPath)
      expect(pendingReads).toBe(0)
      expect(cache.searchIndex.dirty).toBe(false)
    }
    finally {
      readSpy.mockRestore()
      enqueue.mockRestore()
      syncGetter.mockRestore()
    }
  })

  it('retries a body edit made while cold asynchronous search is yielded', async () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Target' })
    const fragment = storage.createSnippetContent(id, {
      label: 'Body',
      language: 'text',
      value: 'oldword',
    })
    const other = storage.createSnippet({ name: 'Other' })
    storage.createSnippetContent(other.id, {
      label: 'Other',
      language: 'text',
      value: 'stable',
    })
    resyncTwiceForLazySnippets()
    let time = 0
    const clock = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => (time += 9))
    let edited = false
    setImmediate(() => {
      storage.updateSnippetContent(id, fragment.id, { value: 'newword' })
      edited = true
    })
    try {
      expect(
        (await storage.getSnippetsAsync!({ search: 'newword' })).map(
          item => item.id,
        ),
      ).toEqual([id])
      expect(edited).toBe(true)
      expect(await storage.getSnippetsAsync!({ search: 'oldword' })).toEqual(
        [],
      )
    }
    finally {
      clock.mockRestore()
    }
  })

  it('materializes lazy fragment bodies on getSnippetById', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Lazy Read' })
    storage.createSnippetContent(id, {
      label: 'Fragment 1',
      language: 'plain_text',
      value: 'lazy body',
    })

    const cache = resyncTwiceForLazySnippets()
    const lazySnippet = cache.snippets.find(snippet => snippet.id === id)
    expect(lazySnippet?.contents[0]?.value).toBeNull()

    const record = storage.getSnippetById(id)
    expect(record?.contents[0]?.value).toBe('lazy body')
  })

  it('finds lazy snippets by fragment body via search', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Search Target' })
    storage.createSnippetContent(id, {
      label: 'Fragment 1',
      language: 'plain_text',
      value: 'needle-body-text',
    })

    resyncTwiceForLazySnippets()

    const results = storage.getSnippets({ search: 'needle-body-text' })
    expect(results.some(snippet => snippet.id === id)).toBe(true)
  })

  it.each(['state', 'entity'] as const)(
    'invalidates rather than patching an unrelated %s',
    (mismatch) => {
      const storage = createSnippetsStorage()
      const { id } = storage.createSnippet({ name: 'Original' })
      storage.getSnippets({ search: 'Original' })
      const cache = getRuntimeCache(getPaths(tempVaultPath))
      const snippet = cache.snippets.find(item => item.id === id)!
      updateRuntimeSearchIndex(
        mismatch === 'state' ? { ...cache.state } : cache.state,
        mismatch === 'entity' ? { ...snippet, name: 'Wrong' } : snippet,
      )
      expect(cache.searchIndex.dirty).toBe(true)
      expect(
        storage.getSnippets({ search: 'Original' }).map(item => item.id),
      ).toEqual([id])
      expect(storage.getSnippets({ search: 'Wrong' })).toEqual([])
    },
  )

  it('updates a warm search index after body edits without losing sibling fragments', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Indexed name' })
    storage.updateSnippet(id, { description: 'indexed description' })
    const first = storage.createSnippetContent(id, {
      label: 'First',
      language: 'text',
      value: 'oldtoken shared',
    })
    storage.createSnippetContent(id, {
      label: 'Second',
      language: 'text',
      value: 'siblingtoken shared',
    })
    const other = storage.createSnippet({ name: 'Other' })
    storage.createSnippetContent(other.id, {
      label: 'Other',
      language: 'text',
      value: 'shared untouched',
    })
    const find = (search: string) =>
      storage
        .getSnippets({ search })
        .map(item => item.id)
        .sort()
    expect(find('oldtoken')).toEqual([id])
    expect(find('newtoken')).toEqual([])
    const cache = getRuntimeCache(getPaths(tempVaultPath))
    const index = cache.searchIndex

    storage.updateSnippetContent(id, first.id, { value: 'newtoken shared' })
    expect(cache.searchIndex).toBe(index)
    expect(index.dirty).toBe(false)
    expect(find('newtoken')).toEqual([id])
    expect(find('oldtoken')).toEqual([])
    expect(find('siblingtoken')).toEqual([id])
    expect(find('indexed name')).toEqual([id])
    expect(find('indexed description')).toEqual([id])
    expect(find('shared')).toEqual([id, other.id].sort())
    expect(cache.searchIndex).toBe(index)
  })

  it('keeps full invalidation for cold edits, metadata, creation, deletion and external sync', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Original' })
    const first = storage.createSnippetContent(id, {
      label: 'First',
      language: 'text',
      value: 'oldtoken',
    })
    storage.createSnippetContent(id, {
      label: 'Second',
      language: 'text',
      value: 'siblingtoken',
    })
    const cache = resyncTwiceForLazySnippets()
    storage.updateSnippetContent(id, first.id, { value: 'newtoken' })
    expect(cache.searchIndex.dirty).toBe(true)
    const find = (search: string) =>
      storage.getSnippets({ search }).map(item => item.id)
    expect(find('newtoken')).toEqual([id])
    expect(find('siblingtoken')).toEqual([id])
    expect(find('oldtoken')).toEqual([])
    storage.updateSnippet(id, { name: 'Renamed' })
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('Renamed')).toEqual([id])
    expect(find('Original')).toEqual([])
    const added = storage.createSnippet({ name: 'Added' })
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('Added')).toEqual([added.id])
    storage.deleteSnippet(added.id)
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('Added')).toEqual([])
    const snippet = cache.snippets.find(item => item.id === id)!
    const absolutePath = path.join(cache.paths.vaultPath, snippet.filePath)
    fs.writeFileSync(
      absolutePath,
      fs
        .readFileSync(absolutePath, 'utf8')
        .replace('newtoken', 'externaltoken'),
    )
    syncSnippetFileWithDisk(cache.paths, snippet.filePath)
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('externaltoken')).toEqual([id])
    expect(find('newtoken')).toEqual([])
  })

  it('keeps fragment bodies intact when renaming a lazy snippet', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Lazy Rename' })
    storage.createSnippetContent(id, {
      label: 'Fragment 1',
      language: 'plain_text',
      value: 'keep me',
    })

    const lazyCache = resyncTwiceForLazySnippets()
    const lazySnippet = lazyCache.snippets.find(snippet => snippet.id === id)
    expect(lazySnippet?.contents[0]?.value).toBeNull()

    // Переименование сериализует сниппет целиком: незагруженные тела
    // должны дочитаться, а не затереться пустыми строками.
    storage.updateSnippet(id, { name: 'Lazy Renamed' })

    const record = storage.getSnippetById(id)
    expect(record?.contents[0]?.value).toBe('keep me')

    const codeRootPath = getPaths(tempVaultPath).vaultPath
    const cache = getRuntimeCache(getPaths(tempVaultPath))
    const renamed = cache.snippets.find(snippet => snippet.id === id)
    const rawSource = fs.readFileSync(
      path.join(codeRootPath, renamed!.filePath),
      'utf8',
    )
    expect(rawSource).toContain('keep me')
  })

  it('keeps sibling fragment bodies when deleting a fragment of a lazy snippet', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Lazy Delete' })
    const first = storage.createSnippetContent(id, {
      label: 'First',
      language: 'plain_text',
      value: 'first body',
    })
    storage.createSnippetContent(id, {
      label: 'Second',
      language: 'plain_text',
      value: 'second body',
    })

    const cache = resyncTwiceForLazySnippets()
    const lazySnippet = cache.snippets.find(snippet => snippet.id === id)
    expect(lazySnippet?.contents[0]?.value).toBeNull()

    // Удаление НЕ последнего фрагмента у ленивого сниппета: тела должны
    // дочитаться до splice, иначе оставшийся фрагмент получит тело соседа.
    storage.deleteSnippetContent(id, first.id)

    const record = storage.getSnippetById(id)
    expect(record?.contents).toHaveLength(1)
    expect(record?.contents[0]?.label).toBe('Second')
    expect(record?.contents[0]?.value).toBe('second body')

    const codeRootPath = getPaths(tempVaultPath).vaultPath
    const runtimeSnippet = getRuntimeCache(
      getPaths(tempVaultPath),
    ).snippets.find(snippet => snippet.id === id)
    const rawSource = fs.readFileSync(
      path.join(codeRootPath, runtimeSnippet!.filePath),
      'utf8',
    )
    expect(rawSource).toContain('second body')
    expect(rawSource).not.toContain('first body')
  })

  it('createSnippet during vault hydration throws VAULT_HYDRATING', () => {
    const storage = createSnippetsStorage()
    const cache = getRuntimeCache(getPaths(tempVaultPath))
    // state.json «ещё не докачан» из облака: создание работало бы на
    // дефолтных счётчиках и чеканило id поверх существующего индекса.
    cache.state.provisional = true

    expect(() => storage.createSnippet({ name: 'Blocked Snippet' })).toThrow(
      'VAULT_HYDRATING',
    )
  })

  it('getSnippetById returns the stored snippet', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Lookup Snippet' })

    expect(storage.getSnippetById(id)).toMatchObject({
      id,
      name: 'Lookup Snippet',
    })
  })

  it('getSnippetById returns null for unknown ids', () => {
    const storage = createSnippetsStorage()

    expect(storage.getSnippetById(99999)).toBeNull()
  })

  it('can limit search to snippet names', () => {
    const storage = createSnippetsStorage()
    const named = storage.createSnippet({ name: 'Compose Helper' })
    const contentOnly = storage.createSnippet({ name: 'API Helper' })

    storage.createSnippetContent(contentOnly.id, {
      label: 'Example',
      language: 'typescript',
      value: 'docker compose up',
    })

    expect(
      storage.getSnippets({ search: 'compose' }).map(snippet => snippet.id),
    ).toContain(contentOnly.id)
    expect(
      storage
        .getSnippets({ search: 'compose', searchNameOnly: 1 })
        .map(snippet => snippet.id),
    ).toEqual([named.id])
  })

  it('sorts snippets by name and updated date', () => {
    vi.useFakeTimers()

    try {
      const storage = createSnippetsStorage()

      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const bravo = storage.createSnippet({ name: 'Bravo' })

      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))
      const alpha = storage.createSnippet({ name: 'Alpha' })

      vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'))
      storage.updateSnippet(bravo.id, { description: 'Updated' })

      expect(
        storage
          .getSnippets({ sort: 'name', order: 'ASC' })
          .map(snippet => snippet.id),
      ).toEqual([alpha.id, bravo.id])
      expect(
        storage
          .getSnippets({ sort: 'updatedAt', order: 'DESC' })
          .map(snippet => snippet.id),
      ).toEqual([bravo.id, alpha.id])
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('createSnippet throws NAME_CONFLICT for duplicate name in same folder', () => {
    const storage = createSnippetsStorage()
    storage.createSnippet({ name: 'Duplicate' })

    expect(() => storage.createSnippet({ name: 'Duplicate' })).toThrow(
      'NAME_CONFLICT',
    )
    expect(() => storage.createSnippet({ name: 'duplicate' })).toThrow(
      'NAME_CONFLICT',
    )
  })

  it('createSnippet allows duplicate name in a different folder', () => {
    const folders = createFoldersStorage()
    const storage = createSnippetsStorage()
    const folder = folders.createFolder({ name: 'Folder A', parentId: null })

    storage.createSnippet({ name: 'Shared' })

    expect(() =>
      storage.createSnippet({ name: 'Shared', folderId: folder.id }),
    ).not.toThrow()
  })

  it('createSnippet allows reusing the name of a deleted snippet', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Reusable' })
    storage.updateSnippet(id, { isDeleted: 1 })

    expect(() => storage.createSnippet({ name: 'Reusable' })).not.toThrow()
  })

  it('updateSnippet rename to existing sibling name throws NAME_CONFLICT', () => {
    const storage = createSnippetsStorage()
    storage.createSnippet({ name: 'Alpha' })
    const { id: bravoId } = storage.createSnippet({ name: 'Bravo' })

    expect(() => storage.updateSnippet(bravoId, { name: 'Alpha' })).toThrow(
      'NAME_CONFLICT',
    )
  })

  it('updateSnippet rename to same name (case-insensitive) is a no-op for uniqueness', () => {
    const storage = createSnippetsStorage()
    const { id } = storage.createSnippet({ name: 'Stable' })

    expect(() => storage.updateSnippet(id, { name: 'stable' })).not.toThrow()
    expect(storage.getSnippetById(id)?.name).toBe('stable')
  })

  it('updateSnippet move into folder with conflicting name auto-renames', () => {
    const folders = createFoldersStorage()
    const storage = createSnippetsStorage()
    const target = folders.createFolder({ name: 'Target', parentId: null })

    storage.createSnippet({ name: 'Shared', folderId: target.id })
    const { id: movingId } = storage.createSnippet({ name: 'Shared' })

    storage.updateSnippet(movingId, { folderId: target.id })

    const moved = storage.getSnippetById(movingId)
    expect(moved?.folder?.id).toBe(target.id)
    expect(moved?.name.toLowerCase()).not.toBe('shared')
    expect(moved?.name.toLowerCase()).toContain('shared')
  })

  it('updates content scoped to the requested snippet when content ids are duplicated', () => {
    const storage = createSnippetsStorage()
    const first = storage.createSnippet({ name: 'First' })
    const second = storage.createSnippet({ name: 'Second' })
    const firstContent = storage.createSnippetContent(first.id, {
      label: 'Fragment 1',
      language: 'plain_text',
      value: 'first value',
    })

    storage.createSnippetContent(second.id, {
      label: 'Fragment 1',
      language: 'plain_text',
      value: 'second value',
    })

    const paths = getPaths(tempVaultPath)
    const cache = getRuntimeCache(paths)
    const secondSnippet = cache.snippets.find(
      snippet => snippet.id === second.id,
    )

    expect(secondSnippet).toBeDefined()
    secondSnippet!.contents[0]!.id = firstContent.id
    writeSnippetToFile(paths, secondSnippet!)

    const result = storage.updateSnippetContent(second.id, firstContent.id, {
      value: 'second updated',
    })

    expect(result).toEqual({
      invalidInput: false,
      notFound: false,
      parentNotFound: false,
    })
    expect(storage.getSnippetById(first.id)?.contents[0]?.value).toBe(
      'first value',
    )
    expect(storage.getSnippetById(second.id)?.contents[0]).toMatchObject({
      id: firstContent.id,
      value: 'second updated',
    })
  })

  it('deletes content scoped to the requested snippet when content ids are duplicated', () => {
    const storage = createSnippetsStorage()
    const first = storage.createSnippet({ name: 'First' })
    const second = storage.createSnippet({ name: 'Second' })
    const firstContent = storage.createSnippetContent(first.id, {
      label: 'Fragment 1',
      language: 'plain_text',
      value: 'first value',
    })

    storage.createSnippetContent(second.id, {
      label: 'Fragment 1',
      language: 'plain_text',
      value: 'second value',
    })

    const paths = getPaths(tempVaultPath)
    const cache = getRuntimeCache(paths)
    const secondSnippet = cache.snippets.find(
      snippet => snippet.id === second.id,
    )

    expect(secondSnippet).toBeDefined()
    secondSnippet!.contents[0]!.id = firstContent.id
    writeSnippetToFile(paths, secondSnippet!)

    expect(storage.deleteSnippetContent(second.id, firstContent.id)).toEqual({
      deleted: true,
    })
    expect(storage.getSnippetById(first.id)?.contents).toHaveLength(1)
    expect(storage.getSnippetById(second.id)?.contents).toHaveLength(0)
  })
})
