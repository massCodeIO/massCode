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

  it('createNote persists custom properties without allowing system frontmatter fields', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({
      name: 'Task Note',
      properties: {
        name: 'Ignored Name',
        status: 'todo',
        type: 'task',
      },
    })

    expect(storage.getNoteById(id)).toMatchObject({
      name: 'Task Note',
      properties: {
        status: 'todo',
        type: 'task',
      },
    })
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

  it('updates note properties without allowing system frontmatter fields', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Property Note' })

    const result = storage.updateNoteProperties(id, {
      properties: {
        name: 'Ignored Name',
        priority: 'high',
        status: 'todo',
        type: 'task',
      },
    })

    expect(result).toEqual({ invalidInput: false, notFound: false })
    expect(storage.getNoteById(id)).toMatchObject({
      name: 'Property Note',
      properties: {
        priority: 'high',
        status: 'todo',
        type: 'task',
      },
    })
  })

  it('unsets note properties', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Unset Property Note' })

    storage.updateNoteProperties(id, {
      properties: {
        status: 'todo',
        type: 'task',
      },
    })

    const result = storage.updateNoteProperties(id, {
      unset: ['status'],
    })

    expect(result).toEqual({ invalidInput: false, notFound: false })
    expect(storage.getNoteById(id)?.properties).toEqual({
      type: 'task',
    })
  })

  it('filters notes by task properties', () => {
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date('2026-05-12T10:00:00.000Z'))

      const storage = createNotesNotesStorage()
      const today = storage.createNote({ name: 'Today Task' })
      const upcoming = storage.createNote({ name: 'Upcoming Task' })
      const done = storage.createNote({ name: 'Done Task' })
      const regular = storage.createNote({ name: 'Regular Note' })

      storage.updateNoteProperties(today.id, {
        properties: {
          due: '2026-05-12',
          status: 'todo',
          type: 'task',
        },
      })
      storage.updateNoteProperties(upcoming.id, {
        properties: {
          due: '2026-05-20',
          status: 'todo',
          type: 'task',
        },
      })
      storage.updateNoteProperties(done.id, {
        properties: {
          due: '2026-05-12',
          status: 'done',
          type: 'task',
        },
      })

      expect(
        storage.getNotes({ propertyType: 'task' }).map(note => note.id),
      ).toEqual(expect.arrayContaining([today.id, upcoming.id, done.id]))
      expect(
        storage
          .getNotes({
            propertyDue: 'today',
            propertyStatusNot: 'done',
            propertyType: 'task',
          })
          .map(note => note.id),
      ).toEqual([today.id])
      expect(
        storage
          .getNotes({
            propertyDue: 'upcoming',
            propertyStatusNot: 'done',
            propertyType: 'task',
          })
          .map(note => note.id),
      ).toEqual([upcoming.id])
      expect(
        storage
          .getNotes({
            propertyStatus: 'done',
            propertyType: 'task',
          })
          .map(note => note.id),
      ).toEqual([done.id])
      expect(storage.getNotes({}).map(note => note.id)).toContain(regular.id)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('filters date-only due dates by the local day', () => {
    const previousTimeZone = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date(2026, 4, 12, 12))

      const storage = createNotesNotesStorage()
      const today = storage.createNote({ name: 'Local Today Task' })

      storage.updateNoteProperties(today.id, {
        properties: {
          due: '2026-05-12',
          status: 'todo',
          type: 'task',
        },
      })

      expect(
        storage
          .getNotes({
            propertyDue: 'today',
            propertyStatusNot: 'done',
            propertyType: 'task',
          })
          .map(note => note.id),
      ).toEqual([today.id])
    }
    finally {
      vi.useRealTimers()

      if (previousTimeZone === undefined) {
        delete process.env.TZ
      }
      else {
        process.env.TZ = previousTimeZone
      }
    }
  })

  it('can limit search to note names', () => {
    const storage = createNotesNotesStorage()
    const named = storage.createNote({ name: 'Compose Notes' })
    const contentOnly = storage.createNote({ name: 'API Notes' })

    storage.updateNoteContent(contentOnly.id, 'docker compose up')

    expect(
      storage.getNotes({ search: 'compose' }).map(note => note.id),
    ).toContain(contentOnly.id)
    expect(
      storage
        .getNotes({ search: 'compose', searchNameOnly: 1 })
        .map(note => note.id),
    ).toEqual([named.id])
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

  it('rewrites a path-based backlink when the target note is renamed', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folder = folders.createFolder({ name: 'Projects', parentId: null })
    const target = storage.createNote({
      name: 'Repository Pattern',
      folderId: folder.id,
    })
    const linker = storage.createNote({ name: 'Linker' })

    storage.updateNoteContent(
      linker.id,
      'See [[Projects/Repository Pattern]] here',
    )

    storage.updateNote(target.id, { name: 'Repository Cache' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Repository Cache]] here',
    )
  })

  it('writes path-based target when next name collides with another note', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const target = storage.createNote({
      name: 'Foo',
      folderId: folderA.id,
    })
    storage.createNote({ name: 'Bar', folderId: folderB.id })

    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Foo]] for context')

    storage.updateNote(target.id, { name: 'Bar' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Folder A/Bar]] for context',
    )
  })

  it('rewrites a path-based backlink to a different path when folder differs', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const target = storage.createNote({
      name: 'Foo',
      folderId: folderA.id,
    })
    storage.createNote({ name: 'Bar', folderId: folderB.id })

    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Folder A/Foo]] here')

    storage.updateNote(target.id, { name: 'Bar' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Folder A/Bar]] here',
    )
  })

  it('preserves alias when rewriting path-based backlinks', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const target = storage.createNote({ name: 'Foo', folderId: folderA.id })
    storage.createNote({ name: 'Bar', folderId: folderB.id })

    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Foo|the foo]] for context')

    storage.updateNote(target.id, { name: 'Bar' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Folder A/Bar|the foo]] for context',
    )
  })

  it('rewrites path-based backlink when the target note is moved between folders', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const target = storage.createNote({ name: 'Foo', folderId: folderA.id })
    storage.createNote({ name: 'Foo', folderId: folderB.id })

    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Folder A/Foo]] here')

    const folderC = folders.createFolder({ name: 'Folder C', parentId: null })
    storage.updateNote(target.id, { folderId: folderC.id })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Folder C/Foo]] here',
    )
  })

  it('promotes a bare backlink to a path when the moved note loses uniqueness', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })
    const folderC = folders.createFolder({ name: 'Folder C', parentId: null })

    const target = storage.createNote({ name: 'Foo', folderId: folderA.id })
    storage.createNote({ name: 'Foo', folderId: folderB.id })

    const linker = storage.createNote({ name: 'Linker', folderId: folderA.id })
    storage.updateNoteContent(linker.id, 'See [[Foo]] here')

    storage.updateNote(target.id, { folderId: folderC.id })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Folder C/Foo]] here',
    )
  })

  it('skips backlink rewrite when neither name nor folder changes', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const target = storage.createNote({ name: 'Foo', folderId: folderA.id })
    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Folder A/Foo]] here')

    storage.updateNote(target.id, { isFavorites: 1 })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Folder A/Foo]] here',
    )
  })

  it('handles simultaneous rename and move in a single update', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const target = storage.createNote({ name: 'Foo', folderId: folderA.id })
    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Folder A/Foo]] here')

    storage.updateNote(target.id, { folderId: folderB.id, name: 'Bar' })

    expect(storage.getNoteById(linker.id)?.content).toBe('See [[Bar]] here')
  })

  it('promotes pre-existing note bare backlinks when a new colliding note is created', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const existing = storage.createNote({ name: 'Foo', folderId: folderA.id })

    const linker = storage.createNote({ name: 'Linker', folderId: folderA.id })
    storage.updateNoteContent(linker.id, 'See [[Foo]] here')

    storage.createNote({ name: 'Foo', folderId: folderB.id })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[Folder A/Foo]] here',
    )
    expect(storage.getNoteById(existing.id)?.name).toBe('Foo')
  })

  it('promotes other same-named note bare backlinks when rename creates a collision', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })

    const renamed = storage.createNote({ name: 'Foo', folderId: folderA.id })
    storage.createNote({ name: 'Bar', folderId: folderB.id })

    const otherLinker = storage.createNote({
      name: 'Linker',
      folderId: folderB.id,
    })
    storage.updateNoteContent(otherLinker.id, 'See [[Bar]] for context')

    storage.updateNote(renamed.id, { name: 'Bar' })

    expect(storage.getNoteById(otherLinker.id)?.content).toBe(
      'See [[Folder B/Bar]] for context',
    )
  })

  it('does not promote bare backlinks when no collision is introduced', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A', parentId: null })
    storage.createNote({ name: 'Foo', folderId: folderA.id })

    const linker = storage.createNote({ name: 'Linker', folderId: folderA.id })
    storage.updateNoteContent(linker.id, 'See [[Foo]] here')

    storage.createNote({ name: 'Bar', folderId: folderA.id })

    expect(storage.getNoteById(linker.id)?.content).toBe('See [[Foo]] here')
  })

  it('leaves bare backlinks unchanged when colliding note has no folder path', () => {
    const folders = createNotesFoldersStorage()
    const storage = createNotesNotesStorage()

    const folderB = folders.createFolder({ name: 'Folder B', parentId: null })
    storage.createNote({ name: 'Foo' })

    const linker = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linker.id, 'See [[Foo]] here')

    storage.createNote({ name: 'Foo', folderId: folderB.id })

    expect(storage.getNoteById(linker.id)?.content).toBe('See [[Foo]] here')
  })
})
