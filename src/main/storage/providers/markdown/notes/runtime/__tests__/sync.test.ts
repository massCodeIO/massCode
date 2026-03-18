import type { NotesPaths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultNotesState, saveNotesState } from '../state'
import {
  syncNotesFoldersWithDisk,
  syncNotesRuntimeWithDisk,
  syncNotesWithDisk,
} from '../sync'

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

const tempDirs: string[] = []

function createNotesPaths(): NotesPaths {
  const notesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-sync-'))
  tempDirs.push(notesRoot)

  const metaDirPath = path.join(notesRoot, '.masscode')

  return {
    inboxDirPath: path.join(metaDirPath, 'inbox'),
    metaDirPath,
    notesRoot,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, 'trash'),
  }
}

afterEach(() => {
  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('syncNotesFoldersWithDisk', () => {
  it('does not derive isOpen from metadata.orderIndex', () => {
    const paths = createNotesPaths()
    const folderPath = path.join(paths.notesRoot, 'Projects')
    fs.ensureDirSync(folderPath)
    fs.writeFileSync(
      path.join(folderPath, '.meta.yaml'),
      'orderIndex: 1\n',
      'utf8',
    )

    const state = createDefaultNotesState()
    syncNotesFoldersWithDisk(paths, state)

    expect(state.folders).toHaveLength(1)
    expect(state.folders[0].isOpen).toBe(0)
  })

  it('normalizes invalid metadata folder id', () => {
    const paths = createNotesPaths()
    const folderPath = path.join(paths.notesRoot, 'Projects')
    fs.ensureDirSync(folderPath)
    fs.writeFileSync(path.join(folderPath, '.meta.yaml'), 'id: -7\n', 'utf8')

    const state = createDefaultNotesState()
    syncNotesFoldersWithDisk(paths, state)

    expect(state.folders).toHaveLength(1)
    expect(state.folders[0].id).toBeGreaterThan(0)
    expect(state.folders[0].id).not.toBe(-7)
  })

  it('reuses previous folder id by path when metadata id is missing', () => {
    const paths = createNotesPaths()
    const folderPath = path.join(paths.notesRoot, 'Projects')
    fs.ensureDirSync(folderPath)

    const now = Date.now()
    const state = createDefaultNotesState()
    state.counters.folderId = 5
    state.folders = [
      {
        createdAt: now,
        icon: null,
        id: 5,
        isOpen: 1,
        name: 'Projects',
        orderIndex: 0,
        parentId: null,
        updatedAt: now,
      },
    ]

    syncNotesFoldersWithDisk(paths, state)

    expect(state.folders).toHaveLength(1)
    expect(state.folders[0].id).toBe(5)
  })
})

describe('syncNotesWithDisk', () => {
  it('includes notes from .masscode/inbox after sync', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    fs.writeFileSync(
      path.join(paths.inboxDirPath, 'inbox-note.md'),
      '---\nid: 1\nname: inbox-note\n---\n',
      'utf8',
    )
    const state = createDefaultNotesState()
    syncNotesWithDisk(paths, state)
    expect(state.notes).toHaveLength(1)
    expect(state.notes[0].filePath).toBe('.masscode/inbox/inbox-note.md')
  })

  it('includes notes from .masscode/trash after sync', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.trashDirPath)
    fs.writeFileSync(
      path.join(paths.trashDirPath, 'deleted-note.md'),
      '---\nid: 2\nname: deleted-note\n---\n',
      'utf8',
    )
    const state = createDefaultNotesState()
    syncNotesWithDisk(paths, state)
    expect(state.notes).toHaveLength(1)
    expect(state.notes[0].filePath).toBe('.masscode/trash/deleted-note.md')
  })

  it('does not include files from .git', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(path.join(paths.notesRoot, '.git'))
    fs.writeFileSync(
      path.join(paths.notesRoot, '.git', 'HEAD.md'),
      'not a note',
      'utf8',
    )
    const state = createDefaultNotesState()
    syncNotesWithDisk(paths, state)
    expect(state.notes).toHaveLength(0)
  })
})

describe('syncNotesRuntimeWithDisk', () => {
  it('flushes pending state writes before loading state', () => {
    const paths = createNotesPaths()
    const state = createDefaultNotesState()
    state.counters.tagId = 1
    state.tags.push({
      createdAt: 1,
      id: 1,
      name: 'pending-tag',
      updatedAt: 1,
    })

    saveNotesState(paths, state)
    const cache = syncNotesRuntimeWithDisk(paths)

    expect(cache.state.tags).toHaveLength(1)
    expect(cache.state.tags[0].name).toBe('pending-tag')
  })
})
