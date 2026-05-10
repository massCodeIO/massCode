import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStorage } from '../../../storage'
import { getNotesPaths } from '../../../storage/providers/markdown/notes/runtime/constants'
import { ensureNotesStateFile } from '../../../storage/providers/markdown/notes/runtime/state'
import { resetNotesRuntimeCache } from '../../../storage/providers/markdown/notes/runtime/sync'
import { applyNotesImportResult } from '../persist'

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

describe('applyNotesImportResult', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'note-import-'))
    resetNotesRuntimeCache()
    ensureNotesStateFile(getNotesPaths(tempVaultPath))
  })

  afterEach(() => {
    resetNotesRuntimeCache()

    if (tempVaultPath) {
      fs.removeSync(tempVaultPath)
    }
  })

  it('renames the Obsidian root folder when the user already has one', () => {
    const storage = useNotesStorage()
    storage.folders.createFolder({ name: 'Obsidian', parentId: null })

    const summary = applyNotesImportResult({
      notes: [
        {
          content: '# Hello',
          name: 'Hello',
        },
      ],
      warnings: [],
    })

    const rootFolders = storage.folders
      .getFolders()
      .filter(folder => folder.parentId === null)
      .map(folder => folder.name)

    expect(summary.createdRootFolderName).toBe('Obsidian 1')
    expect(rootFolders).toEqual(
      expect.arrayContaining(['Obsidian', 'Obsidian 1']),
    )
  })

  it('does not create a root folder when there are no notes', () => {
    const storage = useNotesStorage()

    const summary = applyNotesImportResult({
      notes: [],
      warnings: [],
    })

    expect(summary.folders).toBe(0)
    expect(summary.createdRootFolderName).toBe('')
    expect(storage.folders.getFolders()).toEqual([])
  })
})
