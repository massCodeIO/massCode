import type { MarkdownNote, NotesPaths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildNoteFromIndexMetadata,
  buildNoteIndexMetadata,
  readNoteFromFile,
  serializeNote,
} from '../notes'

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
      properties: {},
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

  it('parses quoted ISO timestamps from frontmatter as stable unix ms', () => {
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date('2026-03-18T19:40:00.000Z'))

      const paths = createNotesPaths()
      const relativePath = 'legacy-date-note.md'
      const absolutePath = path.join(paths.notesRoot, relativePath)
      const createdAtIso = '2026-03-18T10:00:00.000Z'
      const updatedAtIso = '2026-03-18T11:00:00.000Z'
      const source
        = '---\n'
          + 'id: 10\n'
          + 'name: Legacy Date Note\n'
          + `createdAt: "${createdAtIso}"\n`
          + `updatedAt: "${updatedAtIso}"\n`
          + '---\n'
          + 'body'

      fs.writeFileSync(absolutePath, source, 'utf8')

      const note = readNoteFromFile(
        paths,
        { filePath: relativePath, id: 10 },
        new Map(),
      )

      expect(note).not.toBeNull()
      expect(note?.createdAt).toBe(new Date(createdAtIso).getTime())
      expect(note?.updatedAt).toBe(new Date(updatedAtIso).getTime())
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('keeps timestamps stable for markdown files without frontmatter', () => {
    vi.useFakeTimers()

    try {
      const paths = createNotesPaths()
      const relativePath = 'plain.md'
      const absolutePath = path.join(paths.notesRoot, relativePath)
      fs.writeFileSync(absolutePath, '# Plain markdown note', 'utf8')

      vi.setSystemTime(new Date('2026-03-18T10:00:00.000Z'))
      const firstRead = readNoteFromFile(
        paths,
        { filePath: relativePath, id: 11 },
        new Map(),
      )
      const normalizedSource = fs.readFileSync(absolutePath, 'utf8')

      vi.setSystemTime(new Date('2026-03-18T12:00:00.000Z'))
      const secondRead = readNoteFromFile(
        paths,
        { filePath: relativePath, id: 11 },
        new Map(),
      )

      expect(firstRead).not.toBeNull()
      expect(secondRead).not.toBeNull()
      expect(normalizedSource.startsWith('---\n')).toBe(true)
      expect(normalizedSource).toContain('createdAt:')
      expect(normalizedSource).toContain('updatedAt:')
      expect(secondRead?.createdAt).toBe(firstRead?.createdAt)
      expect(secondRead?.updatedAt).toBe(firstRead?.updatedAt)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('preserves unknown frontmatter properties after read and serialize', () => {
    const paths = createNotesPaths()
    const relativePath = 'properties.md'
    const absolutePath = path.join(paths.notesRoot, relativePath)
    const source
      = '---\n'
        + 'id: 12\n'
        + 'name: Properties\n'
        + 'type: task\n'
        + 'status: todo\n'
        + 'priority: high\n'
        + 'rating: 5\n'
        + 'source: book\n'
        + '---\n'
        + 'body'

    fs.writeFileSync(absolutePath, source, 'utf8')

    const note = readNoteFromFile(
      paths,
      { filePath: relativePath, id: 12 },
      new Map(),
    )

    expect(note).not.toBeNull()
    expect(note?.properties).toEqual({
      priority: 'high',
      rating: 5,
      source: 'book',
      status: 'todo',
      type: 'task',
    })

    fs.writeFileSync(absolutePath, serializeNote(note!), 'utf8')

    const roundTrip = readNoteFromFile(
      paths,
      { filePath: relativePath, id: 12 },
      new Map(),
    )

    expect(roundTrip?.properties).toEqual(note?.properties)
  })

  it('keeps exotic YAML properties lossless and index-safe', () => {
    const paths = createNotesPaths()
    const relativePath = 'exotic-properties.md'
    const absolutePath = path.join(paths.notesRoot, relativePath)

    // Валидный YAML: рекурсивный alias даёт циклический объект, timestamp —
    // Date, .nan — NaN, !!binary — Uint8Array. Цикл без разрыва валил бы
    // JSON-персист metadata-индекса, а остальные значения должны пережить
    // и запись обратно во frontmatter, и JSON round-trip индекса без порчи.
    const source
      = '---\n'
        + 'id: 21\n'
        + 'name: Exotic\n'
        + 'loop: &a\n'
        + '  self: *a\n'
        + 'date: 2024-01-15\n'
        + 'score: .nan\n'
        + 'blob: !!binary aGVsbG8=\n'
        + '---\n'
        + 'body'

    fs.writeFileSync(absolutePath, source, 'utf8')

    const note = readNoteFromFile(
      paths,
      { filePath: relativePath, id: 21 },
      new Map(),
    )

    expect(note).not.toBeNull()
    // Цикл разорван, остальные значения сохранены как есть.
    expect(note?.properties.loop).toEqual({ self: null })
    expect(note?.properties.date).toBeInstanceOf(Date)
    expect(Number.isNaN(note?.properties.score)).toBe(true)
    expect(note?.properties.blob).toBeInstanceOf(Uint8Array)

    // Запись обратно во frontmatter сохраняет семантику значений.
    fs.writeFileSync(absolutePath, serializeNote(note!), 'utf8')
    const reread = readNoteFromFile(
      paths,
      { filePath: relativePath, id: 21 },
      new Map(),
    )
    expect((reread?.properties.date as Date).getTime()).toBe(
      (note?.properties.date as Date).getTime(),
    )
    expect(Number.isNaN(reread?.properties.score)).toBe(true)
    expect(reread?.properties.blob).toEqual(note?.properties.blob)

    // JSON round-trip metadata-индекса обратим и не падает.
    const meta = buildNoteIndexMetadata(note!, { mtimeMs: 1, size: 1 })
    const persisted = JSON.parse(JSON.stringify(meta))
    const restored = buildNoteFromIndexMetadata(
      { filePath: relativePath, id: 21 },
      persisted,
    )
    expect(restored.properties.date).toBeInstanceOf(Date)
    expect((restored.properties.date as Date).getTime()).toBe(
      (note?.properties.date as Date).getTime(),
    )
    expect(Number.isNaN(restored.properties.score)).toBe(true)
    expect(restored.properties.blob).toEqual(note?.properties.blob)
  })

  it('does not add task fields to plain markdown after normalization', () => {
    const paths = createNotesPaths()
    const relativePath = 'plain-no-task.md'
    const absolutePath = path.join(paths.notesRoot, relativePath)
    fs.writeFileSync(absolutePath, 'plain body', 'utf8')

    const note = readNoteFromFile(
      paths,
      { filePath: relativePath, id: 13 },
      new Map(),
    )

    expect(note).not.toBeNull()
    expect(note?.properties).toEqual({})

    const normalizedSource = fs.readFileSync(absolutePath, 'utf8')
    expect(normalizedSource).not.toContain('type: task')
    expect(normalizedSource).not.toContain('status:')
    expect(normalizedSource).not.toContain('priority:')
    expect(normalizedSource).not.toContain('due:')
  })
})
