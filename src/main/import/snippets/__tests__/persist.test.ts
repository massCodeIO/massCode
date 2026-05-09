import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStorage } from '../../../storage'
import { getPaths } from '../../../storage/providers/markdown/runtime/paths'
import { ensureStateFile } from '../../../storage/providers/markdown/runtime/state'
import { resetRuntimeCache } from '../../../storage/providers/markdown/runtime/sync'
import { applySnippetImportResult } from '../persist'

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

vi.mock('../../../store', () => ({
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

describe('applySnippetImportResult', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'snippet-import-'))
    resetRuntimeCache()
    ensureStateFile(getPaths(tempVaultPath))
  })

  afterEach(() => {
    resetRuntimeCache()

    if (tempVaultPath) {
      fs.removeSync(tempVaultPath)
    }
  })

  it('renames the source root folder when the user already has one', () => {
    const storage = useStorage()
    storage.folders.createFolder({ name: 'Raycast', parentId: null })

    const summary = applySnippetImportResult('raycast-snippets', {
      snippets: [
        {
          contents: [
            {
              label: 'Fragment 1',
              language: 'plain_text',
              value: 'Hello',
            },
          ],
          name: 'Greeting',
        },
      ],
      warnings: [],
    })

    const rootFolders = storage.folders
      .getFolders()
      .filter(folder => folder.parentId === null)
      .map(folder => folder.name)

    expect(summary.createdRootFolderName).toBe('Raycast 1')
    expect(rootFolders).toEqual(
      expect.arrayContaining(['Raycast', 'Raycast 1']),
    )
  })
})
