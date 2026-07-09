import type { NotesPaths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureNoteContentLoaded } from '../notes'
import { loadNotesState } from '../state'
import { resetNotesRuntimeCache, syncNotesRuntimeWithDisk } from '../sync'

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

vi.mock('../../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

const tempDirs: string[] = []

function createNotesPaths(): NotesPaths {
  const notesRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'notes-metadata-index-'),
  )
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

function writeNoteFixture(
  paths: NotesPaths,
  relativePath: string,
  id: number,
  name: string,
  body = 'note body',
): string {
  const absolutePath = path.join(paths.notesRoot, relativePath)
  const source = [
    '---',
    `id: ${id}`,
    `name: ${name}`,
    'createdAt: 1700000000000',
    'updatedAt: 1700000000000',
    'isDeleted: 0',
    'isFavorites: 0',
    'tags: []',
    '---',
    body,
    '',
  ].join('\n')

  fs.ensureDirSync(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, source, 'utf8')

  return absolutePath
}

// Мутирует файл и подгоняет stat-сигнатуру индекса под новый stat:
// получается сценарий «файл не менялся» — если скан всё равно отдаёт старые
// данные из индекса, значит файл действительно не читался.
function mutateFileKeepingIndexSignature(
  paths: NotesPaths,
  absolutePath: string,
  mutate: (source: string) => string,
): void {
  const source = fs.readFileSync(absolutePath, 'utf8')
  fs.writeFileSync(absolutePath, mutate(source), 'utf8')

  const stats = fs.statSync(absolutePath)
  const persisted = fs.readJsonSync(paths.statePath) as {
    notes: { meta?: { mtimeMs: number, size: number } }[]
  }
  persisted.notes[0].meta!.mtimeMs = stats.mtimeMs
  persisted.notes[0].meta!.size = stats.size
  fs.writeJsonSync(paths.statePath, persisted)
}

afterEach(() => {
  resetNotesRuntimeCache()

  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('notes metadata index', () => {
  it('fills index metadata on first scan and persists it in state.json', () => {
    const paths = createNotesPaths()
    writeNoteFixture(paths, 'First.md', 1, 'First')

    syncNotesRuntimeWithDisk(paths)

    const persisted = fs.readJsonSync(paths.statePath) as {
      notes: { id: number, meta?: { mtimeMs: number, name: string } }[]
      version: number
    }

    expect(persisted.version).toBe(2)
    expect(persisted.notes[0].meta?.name).toBe('First')
    expect(persisted.notes[0].meta?.mtimeMs).toBeGreaterThan(0)

    // Схема записи строгая: посторонние поля не персистятся.
    expect(Object.keys(persisted.notes[0]).sort()).toEqual([
      'filePath',
      'id',
      'meta',
    ])
  })

  it('builds untouched notes from the index without reading files', () => {
    const paths = createNotesPaths()
    const absolutePath = writeNoteFixture(paths, 'Lazy.md', 1, 'Lazy')

    // Первый скан читает файл и заполняет индекс.
    syncNotesRuntimeWithDisk(paths)

    // Имя в файле меняется, но сигнатура индекса совпадает со stat: если
    // повторный скан отдаёт старое имя, файл действительно не читался.
    mutateFileKeepingIndexSignature(paths, absolutePath, source =>
      source.replace('name: Lazy', 'name: Hack'))

    resetNotesRuntimeCache()
    const cache = syncNotesRuntimeWithDisk(paths)
    const note = cache.notes.find(item => item.id === 1)

    expect(note?.name).toBe('Lazy')
    expect(note?.content).toBeNull()
  })

  it('lazily loads note content on demand', () => {
    const paths = createNotesPaths()
    writeNoteFixture(paths, 'Demand.md', 1, 'Demand')

    syncNotesRuntimeWithDisk(paths)
    resetNotesRuntimeCache()
    const cache = syncNotesRuntimeWithDisk(paths)
    const note = cache.notes.find(item => item.id === 1)

    expect(note?.content).toBeNull()
    expect(ensureNoteContentLoaded(paths, note!)).toBe(true)
    expect(note?.content).toContain('note body')
  })

  it('re-reads notes whose stat signature changed', () => {
    const paths = createNotesPaths()
    const absolutePath = writeNoteFixture(paths, 'Changed.md', 1, 'Before')

    syncNotesRuntimeWithDisk(paths)

    // Обычная внешняя правка: mtime меняется, файл перечитывается.
    writeNoteFixture(paths, 'Changed.md', 1, 'After')
    fs.utimesSync(absolutePath, new Date(), new Date(Date.now() + 5_000))

    resetNotesRuntimeCache()
    const cache = syncNotesRuntimeWithDisk(paths)
    const note = cache.notes.find(item => item.id === 1)

    expect(note?.name).toBe('After')
    expect(note?.content).toContain('note body')
  })

  it('backfills metadata for legacy v1 index entries', () => {
    const paths = createNotesPaths()
    writeNoteFixture(paths, 'Legacy.md', 5, 'Legacy')

    // v1-индекс: записи без метаданных, только { id, filePath }.
    fs.ensureDirSync(paths.metaDirPath)
    fs.writeJsonSync(paths.statePath, {
      counters: { folderId: 0, noteId: 5, tagId: 0 },
      folderUi: {},
      notes: [{ filePath: 'Legacy.md', id: 5 }],
      tags: [],
      version: 1,
    })

    const cache = syncNotesRuntimeWithDisk(paths)
    const note = cache.notes.find(item => item.id === 5)

    // Файл прочитан один раз (тело на месте), а индекс дозаполнен.
    expect(note?.name).toBe('Legacy')
    expect(note?.content).toContain('note body')

    const state = loadNotesState(paths)
    expect(state.notes[0].meta?.name).toBe('Legacy')
    expect(state.version).toBe(2)
  })
})
