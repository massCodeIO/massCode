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

describe('folders storage validations', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'folders-storage-'))
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

  it('updateFolder with empty patch returns invalidInput', () => {
    const storage = createNotesFoldersStorage()
    const { id } = storage.createFolder({ name: 'Test Folder' })
    const result = storage.updateFolder(id, {})
    expect(result).toEqual({ invalidInput: true, notFound: false })
  })

  it('moving folder to sibling with same name auto-renames', () => {
    const storage = createNotesFoldersStorage()

    const { id: parentId } = storage.createFolder({ name: 'Parent' })

    storage.createFolder({ name: 'Dupe', parentId })
    const { id: rootDupeId } = storage.createFolder({ name: 'Dupe' })

    storage.updateFolder(rootDupeId, { parentId })

    const moved = storage.getFolders().find(f => f.id === rootDupeId)
    expect(moved?.parentId).toBe(parentId)
    expect(moved?.name.toLowerCase()).not.toBe('dupe')
    expect(moved?.name.toLowerCase()).toContain('dupe')
  })

  it('rename to existing disk directory throws NAME_CONFLICT', () => {
    const storage = createNotesFoldersStorage()
    const { id } = storage.createFolder({ name: 'Source' })
    storage.getFolders()

    const notesRoot = path.join(tempVaultPath, 'notes')
    fs.ensureDirSync(path.join(notesRoot, 'Target'))

    expect(() => storage.updateFolder(id, { name: 'Target' })).toThrow(
      'NAME_CONFLICT',
    )
  })

  it('rewrites path-based backlinks when a folder is renamed', () => {
    const folders = createNotesFoldersStorage()
    const notes = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A' })
    const folderB = folders.createFolder({ name: 'Folder B' })

    notes.createNote({ name: 'Foo', folderId: folderA.id })
    notes.createNote({ name: 'Foo', folderId: folderB.id })

    const linker = notes.createNote({ name: 'Linker' })
    notes.updateNoteContent(linker.id, 'See [[Folder A/Foo]] here')

    folders.updateFolder(folderA.id, { name: 'Renamed' })

    expect(notes.getNoteById(linker.id)?.content).toBe(
      'See [[Renamed/Foo]] here',
    )
  })

  it('rewrites path-based backlinks when a folder is moved into another', () => {
    const folders = createNotesFoldersStorage()
    const notes = createNotesNotesStorage()

    const root = folders.createFolder({ name: 'Root' })
    const folderA = folders.createFolder({ name: 'Folder A' })
    const folderB = folders.createFolder({ name: 'Folder B' })

    notes.createNote({ name: 'Foo', folderId: folderA.id })
    notes.createNote({ name: 'Foo', folderId: folderB.id })

    const linker = notes.createNote({ name: 'Linker' })
    notes.updateNoteContent(linker.id, 'See [[Folder A/Foo]] here')

    folders.updateFolder(folderA.id, { parentId: root.id })

    expect(notes.getNoteById(linker.id)?.content).toBe(
      'See [[Root/Folder A/Foo]] here',
    )
  })

  it('cascades path rewrite when an ancestor folder is renamed', () => {
    const folders = createNotesFoldersStorage()
    const notes = createNotesNotesStorage()

    const projects = folders.createFolder({ name: 'Projects' })
    const child = folders.createFolder({
      name: 'Active',
      parentId: projects.id,
    })
    const other = folders.createFolder({ name: 'Other' })

    notes.createNote({ name: 'Foo', folderId: child.id })
    notes.createNote({ name: 'Foo', folderId: other.id })

    const linker = notes.createNote({ name: 'Linker' })
    notes.updateNoteContent(linker.id, 'See [[Projects/Active/Foo]] here')

    folders.updateFolder(projects.id, { name: 'Workspace' })

    expect(notes.getNoteById(linker.id)?.content).toBe(
      'See [[Workspace/Active/Foo]] here',
    )
  })

  it('leaves bare backlinks unchanged when a folder is renamed', () => {
    const folders = createNotesFoldersStorage()
    const notes = createNotesNotesStorage()

    const folderA = folders.createFolder({ name: 'Folder A' })

    notes.createNote({ name: 'Foo', folderId: folderA.id })

    const linker = notes.createNote({ name: 'Linker' })
    notes.updateNoteContent(linker.id, 'See [[Foo]] here')

    folders.updateFolder(folderA.id, { name: 'Renamed' })

    expect(notes.getNoteById(linker.id)?.content).toBe('See [[Foo]] here')
  })
})
