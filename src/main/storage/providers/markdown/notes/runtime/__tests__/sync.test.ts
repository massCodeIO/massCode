import type { NotesPaths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stateContentCacheByPath } from '../../../runtime/cache'
import { listEntryFirst } from '../../../runtime/shared/__tests__/listEntryFirst'
import { waitForNotesAssetsMigrationForTests } from '../assetsMigration'
import { createDefaultNotesState, saveNotesState } from '../state'
import {
  resetNotesRuntimeCache,
  syncNoteFileWithDisk,
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
    assetsPath: path.join(metaDirPath, 'assets'),
    inboxDirPath: path.join(metaDirPath, 'inbox'),
    legacyAssetsPath: path.join(notesRoot, 'assets'),
    metaDirPath,
    notesRoot,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, 'trash'),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  resetNotesRuntimeCache()
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

  it('does not hand out ids already taken by frontmatter when state.json is missing', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    // Порядок обхода не гарантирован; при алфавитном (как на APFS) файлы
    // без id встречаются раньше файлов с явными id.
    const fixtures: [string, number | null][] = [
      ['a-without-id.md', null],
      ['b-with-id-1.md', 1],
      ['c-with-id-2.md', 2],
      ['d-without-id.md', null],
    ]
    for (const [fileName, id] of fixtures) {
      fs.writeFileSync(
        path.join(paths.inboxDirPath, fileName),
        `---\n${id === null ? '' : `id: ${id}\n`}name: ${fileName}\n---\nBody\n`,
        'utf8',
      )
    }

    const cache = syncNotesRuntimeWithDisk(paths)
    const idByName = new Map(
      cache.state.notes.map(entry => [
        path.posix.basename(entry.filePath),
        entry.id,
      ]),
    )

    expect(idByName.get('b-with-id-1.md')).toBe(1)
    expect(idByName.get('c-with-id-2.md')).toBe(2)

    const ids = cache.state.notes.map(entry => entry.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    expect(cache.noteById.size).toBe(4)
    expect(cache.state.counters.noteId).toBe(Math.max(...ids))
  })

  it('keeps ids of indexed notes and allocates new ones above the counter when state.json exists', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    const writeNote = (fileName: string, id: number | null) =>
      fs.writeFileSync(
        path.join(paths.inboxDirPath, fileName),
        `---\n${id === null ? '' : `id: ${id}\n`}name: ${fileName}\n---\nBody\n`,
        'utf8',
      )
    writeNote('a.md', 5)
    writeNote('b.md', 7)
    syncNotesRuntimeWithDisk(paths)
    resetNotesRuntimeCache()
    expect(fs.existsSync(paths.statePath)).toBe(true)

    // Порядок обхода не гарантирован; при алфавитном (как на APFS) новый
    // файл без id встречается раньше файла с занятым id.
    writeNote('c-without-id.md', null)
    writeNote('d-free-id-3.md', 3)
    writeNote('e-taken-id-5.md', 5)

    const readSource = (fileName: string) =>
      fs.readFileSync(path.join(paths.inboxDirPath, fileName), 'utf8')
    const unchangedFiles = [
      'a.md',
      'b.md',
      'd-free-id-3.md',
      'e-taken-id-5.md',
    ]
    const sourcesBefore = unchangedFiles.map(readSource)

    const cache = syncNotesRuntimeWithDisk(paths)
    const idByName = new Map(
      cache.state.notes.map(entry => [
        path.posix.basename(entry.filePath),
        entry.id,
      ]),
    )

    expect(idByName.get('a.md')).toBe(5)
    expect(idByName.get('b.md')).toBe(7)
    expect(idByName.get('d-free-id-3.md')).toBe(3)
    expect(
      new Set([
        idByName.get('c-without-id.md'),
        idByName.get('e-taken-id-5.md'),
      ]),
    ).toEqual(new Set([8, 9]))
    expect(new Set(idByName.values()).size).toBe(5)
    expect(cache.state.counters.noteId).toBe(9)
    expect(unchangedFiles.map(readSource)).toEqual(sourcesBefore)
  })

  it('does not let a copy of an indexed note take the id of the original', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    const originalPath = path.join(paths.inboxDirPath, 'Foo.md')
    fs.writeFileSync(
      originalPath,
      '---\nid: 5\nname: Foo\n---\nBody\n',
      'utf8',
    )
    syncNotesRuntimeWithDisk(paths)
    resetNotesRuntimeCache()
    expect(fs.existsSync(paths.statePath)).toBe(true)

    const copyPath = path.join(paths.inboxDirPath, 'Foo copy.md')
    fs.copyFileSync(originalPath, copyPath)
    const sourcesBefore = [originalPath, copyPath].map(filePath =>
      fs.readFileSync(filePath, 'utf8'),
    )
    listEntryFirst('Foo copy.md')

    const cache = syncNotesRuntimeWithDisk(paths)
    const idByName = new Map(
      cache.state.notes.map(entry => [
        path.posix.basename(entry.filePath),
        entry.id,
      ]),
    )

    expect(idByName.get('Foo.md')).toBe(5)
    expect(idByName.get('Foo copy.md')).toBe(cache.state.counters.noteId)
    expect(cache.state.counters.noteId).toBeGreaterThan(5)
    expect(
      [originalPath, copyPath].map(filePath =>
        fs.readFileSync(filePath, 'utf8'),
      ),
    ).toEqual(sourcesBefore)
  })

  it('keeps the frontmatter id of an indexed note renamed outside the app', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    const originalPath = path.join(paths.inboxDirPath, 'Foo.md')
    fs.writeFileSync(
      originalPath,
      '---\nid: 5\nname: Foo\n---\nBody\n',
      'utf8',
    )
    syncNotesRuntimeWithDisk(paths)
    resetNotesRuntimeCache()

    fs.moveSync(originalPath, path.join(paths.inboxDirPath, 'Bar.md'))

    const cache = syncNotesRuntimeWithDisk(paths)

    expect(cache.state.notes).toHaveLength(1)
    expect(cache.state.notes[0].filePath).toBe('.masscode/inbox/Bar.md')
    expect(cache.state.notes[0].id).toBe(5)
  })

  it('hands out finite ids when the index has an entry without id', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    fs.writeFileSync(
      path.join(paths.inboxDirPath, 'a.md'),
      '---\nid: 5\nname: a\n---\nBody\n',
      'utf8',
    )
    syncNotesRuntimeWithDisk(paths)
    resetNotesRuntimeCache()

    const rawState = JSON.parse(fs.readFileSync(paths.statePath, 'utf8')) as {
      notes: Record<string, unknown>[]
    }
    rawState.notes.push({ filePath: 'ghost.md' })
    fs.writeFileSync(paths.statePath, JSON.stringify(rawState), 'utf8')
    stateContentCacheByPath.delete(paths.statePath)
    resetNotesRuntimeCache()
    fs.writeFileSync(
      path.join(paths.inboxDirPath, 'b-without-id.md'),
      '---\nname: b-without-id\n---\nBody\n',
      'utf8',
    )

    const cache = syncNotesRuntimeWithDisk(paths)
    const created = cache.state.notes.find(
      entry => path.posix.basename(entry.filePath) === 'b-without-id.md',
    )!

    expect(Number.isInteger(created.id)).toBe(true)
    expect(created.id).toBeGreaterThan(5)
    expect(Number.isFinite(cache.state.counters.noteId)).toBe(true)
  })
})

describe('syncNoteFileWithDisk', () => {
  it('adds a new note to the runtime cache incrementally', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    fs.writeFileSync(
      path.join(paths.inboxDirPath, 'first.md'),
      '---\nid: 1\nname: first\n---\nFirst body\n',
      'utf8',
    )

    const cache = syncNotesRuntimeWithDisk(paths)
    expect(cache.notes).toHaveLength(1)

    fs.writeFileSync(
      path.join(paths.inboxDirPath, 'second.md'),
      '---\nid: 2\nname: second\n---\nSecond body\n',
      'utf8',
    )

    const nextCache = syncNoteFileWithDisk(paths, '.masscode/inbox/second.md')

    expect(nextCache).not.toBeNull()
    expect(nextCache).not.toBe(cache)
    expect(nextCache!.notes).toHaveLength(2)
    expect(nextCache!.noteById.get(2)?.name).toBe('second')
    expect(nextCache!.state.notes).toHaveLength(2)
  })

  it('keeps note id when external move processes add before unlink', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    const sourcePath = path.join(paths.inboxDirPath, 'source.md')
    fs.writeFileSync(
      sourcePath,
      '---\nid: 7\nname: source\n---\nBody\n',
      'utf8',
    )

    syncNotesRuntimeWithDisk(paths)

    // Внешний mv source.md → target.md: add нового пути приходит раньше
    // unlink старого.
    const targetPath = path.join(paths.inboxDirPath, 'target.md')
    fs.moveSync(sourcePath, targetPath)

    const afterAdd = syncNoteFileWithDisk(paths, '.masscode/inbox/target.md')

    expect(afterAdd).not.toBeNull()
    expect(afterAdd!.notes).toHaveLength(1)
    expect(afterAdd!.noteById.get(7)?.name).toBe('source')
    expect(afterAdd!.state.notes).toHaveLength(1)
    expect(afterAdd!.state.notes[0]).toMatchObject({
      filePath: '.masscode/inbox/target.md',
      id: 7,
    })

    const afterUnlink = syncNoteFileWithDisk(
      paths,
      '.masscode/inbox/source.md',
    )

    expect(afterUnlink).not.toBeNull()
    expect(afterUnlink!.notes).toHaveLength(1)
    expect(afterUnlink!.noteById.get(7)?.name).toBe('source')
  })

  it('updates an existing note in the runtime cache incrementally', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    const notePath = path.join(paths.inboxDirPath, 'note.md')
    fs.writeFileSync(
      notePath,
      '---\nid: 1\nname: note\n---\nOriginal body\n',
      'utf8',
    )

    syncNotesRuntimeWithDisk(paths)

    fs.writeFileSync(
      notePath,
      '---\nid: 1\nname: note\n---\nUpdated body\n',
      'utf8',
    )

    const nextCache = syncNoteFileWithDisk(paths, '.masscode/inbox/note.md')

    expect(nextCache).not.toBeNull()
    expect(nextCache!.notes).toHaveLength(1)
    expect(nextCache!.noteById.get(1)?.content).toContain('Updated body')
  })

  it('removes a deleted note from the runtime cache incrementally', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    const notePath = path.join(paths.inboxDirPath, 'note.md')
    fs.writeFileSync(notePath, '---\nid: 1\nname: note\n---\nBody\n', 'utf8')

    const cache = syncNotesRuntimeWithDisk(paths)
    expect(cache.notes).toHaveLength(1)

    fs.removeSync(notePath)

    const nextCache = syncNoteFileWithDisk(paths, '.masscode/inbox/note.md')

    expect(nextCache).not.toBeNull()
    expect(nextCache!.notes).toHaveLength(0)
    expect(nextCache!.noteById.has(1)).toBe(false)
    expect(nextCache!.state.notes).toHaveLength(0)
  })

  it('returns null for files in unknown directories to force a full sync', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    syncNotesRuntimeWithDisk(paths)

    fs.ensureDirSync(path.join(paths.notesRoot, 'Unknown'))
    fs.writeFileSync(
      path.join(paths.notesRoot, 'Unknown', 'note.md'),
      '---\nid: 3\nname: note\n---\nBody\n',
      'utf8',
    )

    expect(syncNoteFileWithDisk(paths, 'Unknown/note.md')).toBeNull()
  })

  it('returns null for non-markdown files', () => {
    const paths = createNotesPaths()
    fs.ensureDirSync(paths.inboxDirPath)
    syncNotesRuntimeWithDisk(paths)

    expect(syncNoteFileWithDisk(paths, '.masscode/state.json')).toBeNull()
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

  it('schedules referenced asset migration after a full sync', async () => {
    const paths = createNotesPaths()
    const fileName = 'abcdefghijklmnop.png'
    fs.ensureDirSync(paths.legacyAssetsPath)
    fs.writeFileSync(path.join(paths.legacyAssetsPath, fileName), 'asset')
    fs.writeFileSync(
      path.join(paths.notesRoot, 'Note.md'),
      `---\nid: 1\nname: Note\n---\n![asset](masscode://notes-asset/${fileName})\n`,
      'utf8',
    )

    syncNotesRuntimeWithDisk(paths)
    await waitForNotesAssetsMigrationForTests()

    expect(fs.pathExistsSync(path.join(paths.assetsPath, fileName))).toBe(true)
    expect(fs.pathExistsSync(path.join(paths.legacyAssetsPath, fileName))).toBe(
      false,
    )
  })

  it('discovers a late reference after successful incremental note sync', async () => {
    const paths = createNotesPaths()
    const fileName = 'abcdefghijklmnop.png'
    fs.ensureDirSync(paths.legacyAssetsPath)
    fs.writeFileSync(path.join(paths.legacyAssetsPath, fileName), 'asset')

    syncNotesRuntimeWithDisk(paths)
    await waitForNotesAssetsMigrationForTests()

    fs.writeFileSync(
      path.join(paths.notesRoot, 'Late.md'),
      `---\nid: 2\nname: Late\n---\n![asset](masscode://notes-asset/${fileName})\n`,
      'utf8',
    )
    expect(syncNoteFileWithDisk(paths, 'Late.md')).not.toBeNull()
    await waitForNotesAssetsMigrationForTests()

    expect(fs.pathExistsSync(path.join(paths.assetsPath, fileName))).toBe(true)
    expect(fs.pathExistsSync(path.join(paths.legacyAssetsPath, fileName))).toBe(
      false,
    )
  })
})

describe('provisional notes state during cloud hydration', () => {
  afterEach(() => {
    resetNotesRuntimeCache()
  })

  it('never persists provisional state over the real index', () => {
    const paths = createNotesPaths()
    fs.writeFileSync(
      path.join(paths.notesRoot, 'Known.md'),
      '---\nid: 1\nname: Known\n---\nbody\n',
      'utf8',
    )
    const cache = syncNotesRuntimeWithDisk(paths)
    const persistedContent = fs.readFileSync(paths.statePath, 'utf8')

    // Состояние помечено как provisional (state.json «ещё не докачан»):
    // даже изменённый индекс не должен доехать до диска.
    cache.state.provisional = true
    cache.state.notes.push({ filePath: 'phantom.md', id: 99 })
    saveNotesState(paths, cache.state, { immediate: true })

    expect(fs.readFileSync(paths.statePath, 'utf8')).toBe(persistedContent)
  })

  it('skips watcher registration of notes while state is provisional', () => {
    const paths = createNotesPaths()
    const cache = syncNotesRuntimeWithDisk(paths)
    cache.state.provisional = true

    fs.writeFileSync(
      path.join(paths.notesRoot, 'Fresh.md'),
      '---\nid: 5\nname: Fresh\n---\nbody\n',
      'utf8',
    )
    const result = syncNoteFileWithDisk(paths, 'Fresh.md')

    // Событие не эскалирует в полный ресинк и не регистрирует файл:
    // его подберёт сверка после докачки state.
    expect(result).toBe(cache)
    expect(cache.state.notes).toHaveLength(0)
  })
})
