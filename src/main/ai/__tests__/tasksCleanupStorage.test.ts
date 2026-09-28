import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNotesStorage } from '../../storage'
import { getNotesPaths } from '../../storage/providers/markdown/notes/runtime/constants'
import { ensureNotesStateFile } from '../../storage/providers/markdown/notes/runtime/state'
import { resetNotesRuntimeCache } from '../../storage/providers/markdown/notes/runtime/sync'
import { getPaths } from '../../storage/providers/markdown/runtime/paths'
import { ensureStateFile } from '../../storage/providers/markdown/runtime/state'
import { resetRuntimeCache } from '../../storage/providers/markdown/runtime/sync'
import { runTasksCleanupWithUndo, undoTasksCleanup } from '../../tasks'

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

vi.mock('../../store', () => ({
  store: {
    app: { set: vi.fn() },
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

vi.mock('../vault', () => ({ vaultIdentity: () => tempVaultPath }))
beforeEach(() => {
  tempVaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-lifecycle-'))
  resetRuntimeCache()
  resetNotesRuntimeCache()
  ensureStateFile(getPaths(tempVaultPath))
  ensureNotesStateFile(getNotesPaths(tempVaultPath))
})
afterEach(() => {
  resetRuntimeCache()
  resetNotesRuntimeCache()
  fs.removeSync(tempVaultPath)
})

it('restores real same-name tasks after Trash renamed one and preserves manual content', () => {
  const { notes, folders } = useNotesStorage()
  const a = folders.createFolder({ name: 'A' }).id
  const b = folders.createFolder({ name: 'B' }).id
  const first = notes.createNote({
    name: 'Task',
    folderId: a,
    properties: { type: 'task', status: 'done' },
  }).id
  const second = notes.createNote({
    name: 'Task',
    folderId: b,
    properties: { type: 'task', status: 'done' },
  }).id
  const result = runTasksCleanupWithUndo(tempVaultPath)
  expect(result).toMatchObject({ status: 'done', count: 2 })
  expect(
    new Set([notes.getNoteById(first)!.name, notes.getNoteById(second)!.name])
      .size,
  ).toBe(2)
  notes.updateNoteContent(second, 'independent manual content')
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: true,
    restored: 2,
    conflicts: [],
  })
  resetNotesRuntimeCache()
  expect(notes.getNoteById(first)).toMatchObject({
    name: 'Task',
    folder: { id: a },
    isDeleted: 0,
  })
  expect(notes.getNoteById(second)).toMatchObject({
    name: 'Task',
    folder: { id: b },
    isDeleted: 0,
    content: 'independent manual content',
  })
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: true,
    restored: 0,
    conflicts: [],
  })
})

it('preserves manual names and refuses a restore collision until the destination is free', () => {
  const { notes, folders } = useNotesStorage()
  const folder = folders.createFolder({ name: 'A' }).id
  const id = notes.createNote({
    name: 'Task',
    folderId: folder,
    properties: { type: 'task', status: 'done' },
  }).id
  const result = runTasksCleanupWithUndo(tempVaultPath)
  notes.updateNote(id, { name: 'Manual' })
  const occupant = notes.createNote({ name: 'manual.md', folderId: folder }).id
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: false,
    restored: 0,
    conflicts: [`note:${id}`],
  })
  expect(notes.getNoteById(id)).toMatchObject({
    name: 'Manual',
    isDeleted: 1,
    folder: null,
  })
  notes.updateNote(occupant, { name: 'Moved aside' })
  expect(undoTasksCleanup(result.receiptId!)).toEqual({
    undone: true,
    restored: 1,
    conflicts: [],
  })
  resetNotesRuntimeCache()
  expect(notes.getNoteById(id)).toMatchObject({
    name: 'Manual',
    isDeleted: 0,
    folder: { id: folder },
  })
})
