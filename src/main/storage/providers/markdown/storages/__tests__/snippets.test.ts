import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getRuntimeCache, writeSnippetToFile } from '../../runtime'
import { getPaths } from '../../runtime/paths'
import { ensureStateFile } from '../../runtime/state'
import { resetRuntimeCache } from '../../runtime/sync'
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
