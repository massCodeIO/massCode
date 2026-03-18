import type { MarkdownNote, NotesPaths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readNoteFromFile, serializeNote } from '../notes'

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
  const notesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-runtime-'))
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

describe('readNoteFromFile', () => {
  it('keeps leading and trailing whitespace in note body', () => {
    const paths = createNotesPaths()
    const relativePath = 'note.md'
    const absolutePath = path.join(paths.notesRoot, relativePath)

    const source
      = '---\n'
        + 'id: 1\n'
        + 'name: Note\n'
        + '---\n'
        + '\n'
        + '  leading spaces\n'
        + 'line 2\n'
        + 'trailing spaces   \n'
    fs.writeFileSync(absolutePath, source, 'utf8')

    const note = readNoteFromFile(
      paths,
      { filePath: relativePath, id: 1 },
      new Map(),
    )

    expect(note).not.toBeNull()
    expect(note?.content).toBe(
      '\n  leading spaces\nline 2\ntrailing spaces   \n',
    )
  })

  it('keeps content unchanged after serialize and read round-trip', () => {
    const paths = createNotesPaths()
    const relativePath = 'roundtrip.md'
    const absolutePath = path.join(paths.notesRoot, relativePath)
    const now = Date.now()

    const note: MarkdownNote = {
      content: 'title\nline 1\nline 2',
      createdAt: now,
      description: null,
      filePath: relativePath,
      folderId: null,
      id: 7,
      isDeleted: 0,
      isFavorites: 0,
      name: 'Roundtrip',
      tags: [],
      updatedAt: now,
    }

    fs.writeFileSync(absolutePath, serializeNote(note), 'utf8')

    const loaded = readNoteFromFile(
      paths,
      { filePath: relativePath, id: note.id },
      new Map(),
    )

    expect(loaded).not.toBeNull()
    expect(loaded?.content).toBe(note.content)
  })
})
