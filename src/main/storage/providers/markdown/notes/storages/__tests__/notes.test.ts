import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ensureNotesStateFile } from '../../runtime/state'
import { resetNotesRuntimeCache } from '../../runtime/sync'
import { createNotesFoldersStorage } from '../folders'
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

  it('createNote throws NAME_CONFLICT for duplicate name in same folder', () => {
    const storage = createNotesNotesStorage()
    storage.createNote({ name: 'Duplicate' })

    expect(() => storage.createNote({ name: 'Duplicate' })).toThrow(
      'NAME_CONFLICT',
    )
    expect(() => storage.createNote({ name: 'duplicate' })).toThrow(
      'NAME_CONFLICT',
    )
  })

  it('createNote allows duplicate name in a different folder', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()
    const folder = folders.createFolder({ name: 'Folder A', parentId: null })

    storage.createNote({ name: 'Shared' })

    expect(() =>
      storage.createNote({ name: 'Shared', folderId: folder.id }),
    ).not.toThrow()
  })

  it('createNote allows reusing the name of a deleted note', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Reusable' })
    storage.updateNote(id, { isDeleted: 1 })

    expect(() => storage.createNote({ name: 'Reusable' })).not.toThrow()
  })

  it('updateNote rename to existing sibling name throws NAME_CONFLICT', () => {
    const storage = createNotesNotesStorage()
    storage.createNote({ name: 'Alpha' })
    const { id: bravoId } = storage.createNote({ name: 'Bravo' })

    expect(() => storage.updateNote(bravoId, { name: 'Alpha' })).toThrow(
      'NAME_CONFLICT',
    )
  })

  it('updateNote rename to same name (case-insensitive) is a no-op for uniqueness', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Stable' })

    expect(() => storage.updateNote(id, { name: 'stable' })).not.toThrow()
    expect(storage.getNoteById(id)?.name).toBe('stable')
  })

  it('updateNote move into folder with conflicting name auto-renames', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()
    const target = folders.createFolder({ name: 'Target', parentId: null })

    storage.createNote({ name: 'Shared', folderId: target.id })
    const { id: movingId } = storage.createNote({ name: 'Shared' })

    storage.updateNote(movingId, { folderId: target.id })

    const moved = storage.getNoteById(movingId)
    expect(moved?.folder?.id).toBe(target.id)
    expect(moved?.name.toLowerCase()).not.toBe('shared')
    expect(moved?.name.toLowerCase()).toContain('shared')
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

  it('rewrites internal links in backlinking notes when a note is renamed', () => {
    const storage = createNotesNotesStorage()

    const target = storage.createNote({ name: 'Old Name' })
    const linker = storage.createNote({ name: 'Linker' })
    const aliasLinker = storage.createNote({ name: 'Alias Linker' })
    const unrelated = storage.createNote({ name: 'Unrelated' })

    storage.updateNoteContent(linker.id, 'See [[Old Name]] for context')
    storage.updateNoteContent(
      aliasLinker.id,
      'See [[old name|the old]] for context',
    )
    storage.updateNoteContent(unrelated.id, 'See [[Other Note]] here')

    storage.updateNote(target.id, { name: 'New Name' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[New Name]] for context',
    )
    expect(storage.getNoteById(aliasLinker.id)?.content).toBe(
      'See [[New Name|the old]] for context',
    )
    expect(storage.getNoteById(unrelated.id)?.content).toBe(
      'See [[Other Note]] here',
    )
  })

  it('does not touch the renamed note own content during backlink rewrite', () => {
    const storage = createNotesNotesStorage()

    const target = storage.createNote({ name: 'Old Name' })
    storage.updateNoteContent(
      target.id,
      'Self reference [[Old Name]] should remain',
    )

    storage.updateNote(target.id, { name: 'New Name' })

    expect(storage.getNoteById(target.id)?.content).toBe(
      'Self reference [[Old Name]] should remain',
    )
  })

  it('rewrites only links that resolved to the renamed note when duplicate names exist', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const earlier = storage.createNote({
      name: 'Shared Name',
      folderId: folderA.id,
    })
    storage.createNote({ name: 'Shared Name', folderId: folderB.id })

    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Shared Name]] here')

    storage.updateNote(earlier.id, { name: 'Renamed One' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Renamed One]] here',
    )
  })

  it('does not rewrite links that resolve to a different note than the renamed one', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    storage.createNote({ name: 'Shared Name', folderId: folderA.id })
    const later = storage.createNote({
      name: 'Shared Name',
      folderId: folderB.id,
    })

    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Shared Name]] here')

    storage.updateNote(later.id, { name: 'Renamed Two' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Shared Name]] here',
    )
  })

  it('skips backlink rewrite for deleted notes', () => {
    const storage = createNotesNotesStorage()

    const target = storage.createNote({ name: 'Old Name' })
    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Old Name]] for context')
    storage.updateNote(linker.id, { isDeleted: 1 })

    storage.updateNote(target.id, { name: 'New Name' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Old Name]] for context',
    )
  })
})
