import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPaths } from '../../runtime/paths'
import { ensureStateFile } from '../../runtime/state'
import { resetRuntimeCache } from '../../runtime/sync'
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
})
