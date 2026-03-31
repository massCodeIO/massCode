import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ensureNotesStateFile } from '../../runtime/state'
import { resetNotesRuntimeCache } from '../../runtime/sync'
import { createNotesNotesStorage } from '../notes'

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

describe('notes storage validations', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-storage-'))
    resetNotesRuntimeCache()

    const notesRoot = path.join(tempVaultPath, 'notes')
    const metaDirPath = path.join(notesRoot, '.masscode')

    ensureNotesStateFile({
      inboxDirPath: path.join(metaDirPath, 'inbox'),
      metaDirPath,
      notesRoot,
      statePath: path.join(metaDirPath, 'state.json'),
      trashDirPath: path.join(metaDirPath, 'trash'),
    })
  })

  afterEach(() => {
    if (tempVaultPath) {
      fs.removeSync(tempVaultPath)
    }
  })

  it('updateNote with empty patch returns invalidInput', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Test Note' })
    const result = storage.updateNote(id, {})
    expect(result).toEqual({ invalidInput: true, notFound: false })
  })

  it('createNote with bad folderId throws FOLDER_NOT_FOUND', () => {
    const storage = createNotesNotesStorage()
    expect(() => storage.createNote({ name: 'Test', folderId: 99999 })).toThrow(
      'FOLDER_NOT_FOUND',
    )
  })

  it('createNote without folderId succeeds', () => {
    const storage = createNotesNotesStorage()
    const result = storage.createNote({ name: 'Normal Note' })
    expect(result.id).toBeGreaterThan(0)
  })

  it('getNoteById returns the stored note', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Lookup Note' })

    expect(storage.getNoteById(id)).toMatchObject({
      id,
      name: 'Lookup Note',
    })
  })

  it('getNoteById returns null for unknown ids', () => {
    const storage = createNotesNotesStorage()

    expect(storage.getNoteById(99999)).toBeNull()
  })

  it('keeps newest created note first after content updates of older notes', () => {
    vi.useFakeTimers()

    try {
      const storage = createNotesNotesStorage()

      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const { id: firstId } = storage.createNote({ name: 'First' })

      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))
      const { id: secondId } = storage.createNote({ name: 'Second' })

      vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'))
      storage.updateNoteContent(firstId, 'updated older note')

      const orderedIds = storage.getNotes({}).map(note => note.id)
      expect(orderedIds).toEqual([secondId, firstId])
    }
    finally {
      vi.useRealTimers()
    }
  })
})
