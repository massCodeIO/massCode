import os from 'node:os'
import path from 'node:path'
import { setImmediate } from 'node:timers'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as cloudDownloads from '../../../cloudDownloads'

import {
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../../../runtime/shared/cloudFiles'
import { cancelNotesAssetsMigration } from '../../runtime/assetsMigration'
import { rewriteBacklinksAfterNoteUpdate } from '../../runtime/backlinks'
import { getNotesPaths } from '../../runtime/constants'
import { updateNotesSearchIndex } from '../../runtime/search'
import { ensureNotesStateFile } from '../../runtime/state'
import {
  getNotesRuntimeCache,
  resetNotesRuntimeCache,
  syncNoteFileWithDisk,
} from '../../runtime/sync'
import { createNotesFoldersStorage } from '../folders'
import { createNotesNotesStorage } from '../notes'

let tempVaultPath = ''

function makeSparsePlaceholder(absolutePath: string, size = 4096): void {
  fs.removeSync(absolutePath)
  const fd = fs.openSync(absolutePath, 'w')
  fs.ftruncateSync(fd, size)
  fs.closeSync(fd)
}

function mockMarkdownFilesAsZeroBlocks() {
  const statSync = fs.statSync.bind(fs)

  return vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
    const stats = statSync(filePath)

    if (
      typeof filePath === 'string'
      && filePath.endsWith('.md')
      && stats.size > 0
    ) {
      return Object.assign(stats, { blocks: 0 })
    }

    return stats
  })
}

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
  BrowserWindow: {
    getAllWindows: () => [],
    getFocusedWindow: () => null,
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
      assetsPath: path.join(metaDirPath, 'assets'),
      inboxDirPath: path.join(metaDirPath, 'inbox'),
      legacyAssetsPath: path.join(notesRoot, 'assets'),
      metaDirPath,
      notesRoot,
      statePath: path.join(metaDirPath, 'state.json'),
      trashDirPath: path.join(metaDirPath, 'trash'),
    })
  })

  afterEach(() => {
    setDatalessProbeForTests(null)
    resetCloudFileExemptions()

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

  it('allows immediate content write and rename of an app-written resident file', () => {
    const paths = getNotesPaths(tempVaultPath)
    const targetPath = path.join(paths.notesRoot, '.masscode/inbox/Renamed.md')
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()

    try {
      const storage = createNotesNotesStorage()
      const { id } = storage.createNote({ name: 'Resident' })

      expect(() => storage.updateNoteContent(id, 'body')).not.toThrow()
      expect(() => storage.updateNote(id, { name: 'Renamed' })).not.toThrow()

      expect(fs.readFileSync(targetPath, 'utf8')).toContain('body')
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('keeps a cloud placeholder unchanged when content update or rename is attempted', () => {
    const paths = getNotesPaths(tempVaultPath)
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Cloud Placeholder' })
    const note = getNotesRuntimeCache(paths).notes.find(
      note => note.id === id,
    )!
    const sourcePath = path.join(paths.notesRoot, note.filePath)
    const targetPath = path.join(
      paths.notesRoot,
      '.masscode/inbox/Renamed Placeholder.md',
    )

    makeSparsePlaceholder(sourcePath)
    resetCloudFileExemptions()
    setDatalessProbeForTests(() => true)
    const statSpy = mockMarkdownFilesAsZeroBlocks()
    const sourceBefore = fs.readFileSync(sourcePath)

    try {
      expect(() =>
        storage.updateNoteContent(id, 'must not be written'),
      ).toThrow('CLOUD_FILE_NOT_DOWNLOADED')
      expect(() =>
        storage.updateNote(id, { name: 'Renamed Placeholder' }),
      ).toThrow('CLOUD_FILE_NOT_DOWNLOADED')

      expect(fs.readFileSync(sourcePath)).toEqual(sourceBefore)
      expect(fs.pathExistsSync(targetPath)).toBe(false)
      expect(storage.getNoteById(id)?.name).toBe('Cloud Placeholder')
    }
    finally {
      statSpy.mockRestore()
    }
  })

  // Два ресинка: первый скан дозаполняет индекс метаданных, второй строит
  // ленивые записи из индекса без чтения тел.
  function resyncTwiceForLazyNotes() {
    resetNotesRuntimeCache()
    getNotesRuntimeCache(getNotesPaths(tempVaultPath))
    resetNotesRuntimeCache()
    return getNotesRuntimeCache(getNotesPaths(tempVaultPath))
  }

  it('does not hydrate bodies for a whitespace-only async query', async () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Target' })
    storage.updateNoteContent(id, 'bodytoken')
    const cache = resyncTwiceForLazyNotes()
    const index = cache.searchIndex
    expect(cache.notes[0].content).toBeNull()
    expect(
      (await storage.getNotesAsync!({ search: '  \n ' })).map(
        item => item.id,
      ),
    ).toEqual([id])
    expect(cache.notes[0].content).toBeNull()
    expect(cache.searchIndex).toBe(index)
  })

  it('matches synchronous filtering and sorting through asynchronous cold search', async () => {
    const storage = createNotesNotesStorage()
    for (const [name, body] of [
      ['Alpha', 'Café bodytoken'],
      ['Beta', 'bodytoken different'],
      ['Gamma', 'unrelated'],
    ]) {
      const { id } = storage.createNote({ name })
      storage.updateNoteContent(id, body)
    }
    resyncTwiceForLazyNotes()
    for (const query of [
      { search: 'bodytoken', sort: 'name' as const, order: 'ASC' as const },
      { search: 'cafe' },
      { search: 'notfound' },
      { search: 'a', searchNameOnly: 1 },
      { search: 'bodytoken', isFavorites: 1 },
      { search: 'bodytoken', isDeleted: 1 },
      { search: '' },
      { search: ' \n ' },
    ]) {
      expect(await storage.getNotesAsync!(query)).toEqual(
        storage.getNotes(query),
      )
    }
  })

  it('keeps unavailable bodies partial without repeating failed reads at the end', async () => {
    const storage = createNotesNotesStorage()
    for (const [name, body] of [
      ['Resident', 'bodytoken'],
      ['Unavailable', 'hiddenbody'],
      ['Failure', 'failedbody'],
    ]) {
      const { id } = storage.createNote({ name })
      storage.updateNoteContent(id, body)
    }
    const cache = resyncTwiceForLazyNotes()
    cancelNotesAssetsMigration()
    const pending = cache.notes.find(item => item.name === 'Unavailable')!
    pending.pendingCloudDownload = true
    const failed = cache.notes.find(item => item.name === 'Failure')!
    const failedPath = path.join(cache.paths.notesRoot, failed.filePath)
    const pendingPath = path.join(cache.paths.notesRoot, pending.filePath)
    const enqueue = vi
      .spyOn(cloudDownloads, 'enqueueCloudDownload')
      .mockImplementation(() => {})
    const read = fs.readFileSync.bind(fs)
    let failures = 0
    let pendingReads = 0
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(((
      file: string,
      ...args: any[]
    ) => {
      if (file === failedPath) {
        failures++
        throw new Error('simulated read failure')
      }
      if (file === pendingPath)
        pendingReads++
      return (read as any)(file, ...args)
    }) as typeof fs.readFileSync)
    const syncGetter = vi.spyOn(storage, 'getNotes')
    try {
      const result = await storage.getNotesAsync!({ search: 'bodytoken' })
      expect(result.map(item => item.name)).toEqual(['Resident'])
      expect(syncGetter).not.toHaveBeenCalled()
      expect(failures).toBe(1)
      expect(enqueue).toHaveBeenCalledWith(failedPath)
      expect(pendingReads).toBe(0)
      expect(cache.searchIndex.dirty).toBe(false)
    }
    finally {
      readSpy.mockRestore()
      enqueue.mockRestore()
      syncGetter.mockRestore()
    }
  })

  it('retries a body edit made while cold asynchronous search is yielded', async () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Target' })
    storage.updateNoteContent(id, 'oldword')
    const other = storage.createNote({ name: 'Other' })
    storage.updateNoteContent(other.id, 'stable')
    resyncTwiceForLazyNotes()
    let time = 0
    const clock = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => (time += 9))
    let edited = false
    setImmediate(() => {
      storage.updateNoteContent(id, 'newword')
      edited = true
    })
    try {
      expect(
        (await storage.getNotesAsync!({ search: 'newword' })).map(
          item => item.id,
        ),
      ).toEqual([id])
      expect(edited).toBe(true)
      expect(await storage.getNotesAsync!({ search: 'oldword' })).toEqual([])
    }
    finally {
      clock.mockRestore()
    }
  })

  it('materializes lazy note content on getNoteById', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Lazy Read' })
    storage.updateNoteContent(id, 'lazy note body')

    const cache = resyncTwiceForLazyNotes()
    const lazyNote = cache.notes.find(note => note.id === id)
    expect(lazyNote?.content).toBeNull()

    const record = storage.getNoteById(id)
    expect(record?.content).toBe('lazy note body')
  })

  it('finds lazy notes by body via search', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Search Target' })
    storage.updateNoteContent(id, 'needle-note-body')

    resyncTwiceForLazyNotes()

    const results = storage.getNotes({ search: 'needle-note-body' })
    expect(results.some(note => note.id === id)).toBe(true)
  })

  it.each(['state', 'entity'] as const)(
    'invalidates rather than patching an unrelated %s',
    (mismatch) => {
      const storage = createNotesNotesStorage()
      const { id } = storage.createNote({ name: 'Original' })
      storage.getNotes({ search: 'Original' })
      const cache = getNotesRuntimeCache(getNotesPaths(tempVaultPath))
      const note = cache.notes.find(item => item.id === id)!
      updateNotesSearchIndex(
        mismatch === 'state' ? { ...cache.state } : cache.state,
        mismatch === 'entity' ? { ...note, name: 'Wrong' } : note,
      )
      expect(cache.searchIndex.dirty).toBe(true)
      expect(
        storage.getNotes({ search: 'Original' }).map(item => item.id),
      ).toEqual([id])
      expect(storage.getNotes({ search: 'Wrong' })).toEqual([])
    },
  )

  it('updates a warm search index after body edits and clears cached misses', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Indexed name' })
    storage.updateNote(id, { description: 'indexed description' })
    storage.updateNoteContent(id, 'oldtoken shared')
    const other = storage.createNote({ name: 'Other' })
    storage.updateNoteContent(other.id, 'shared untouched')
    const find = (search: string) =>
      storage
        .getNotes({ search })
        .map(item => item.id)
        .sort()
    expect(find('oldtoken')).toEqual([id])
    expect(find('newtoken')).toEqual([])
    const cache = getNotesRuntimeCache(getNotesPaths(tempVaultPath))
    const index = cache.searchIndex
    storage.updateNoteContent(id, 'newtoken shared')
    expect(cache.searchIndex).toBe(index)
    expect(index.dirty).toBe(false)
    expect(find('newtoken')).toEqual([id])
    expect(find('oldtoken')).toEqual([])
    expect(find('indexed name')).toEqual([id])
    expect(find('indexed description')).toEqual([id])
    expect(find('shared')).toEqual([id, other.id].sort())
    expect(cache.searchIndex).toBe(index)
  })

  it('keeps full invalidation for cold edits, metadata, creation, deletion and external sync', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Original' })
    storage.updateNoteContent(id, 'oldtoken')
    const sibling = storage.createNote({ name: 'Sibling' })
    storage.updateNoteContent(sibling.id, 'latentword')
    const cache = resyncTwiceForLazyNotes()
    storage.updateNoteContent(id, 'newtoken')
    expect(
      cache.notes.find(note => note.id === sibling.id)?.content,
    ).toBeNull()
    const find = (search: string) =>
      storage.getNotes({ search }).map(item => item.id)
    expect(find('newtoken')).toEqual([id])
    expect(find('oldtoken')).toEqual([])
    expect(find('latentword')).toEqual([sibling.id])
    storage.updateNote(id, { name: 'Renamed' })
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('Renamed')).toEqual([id])
    expect(find('Original')).toEqual([])
    const added = storage.createNote({ name: 'Added' })
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('Added')).toEqual([added.id])
    storage.deleteNote(added.id)
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('Added')).toEqual([])
    const note = cache.notes.find(item => item.id === id)!
    const absolutePath = path.join(cache.paths.notesRoot, note.filePath)
    fs.writeFileSync(
      absolutePath,
      fs
        .readFileSync(absolutePath, 'utf8')
        .replace('newtoken', 'externaltoken'),
    )
    syncNoteFileWithDisk(cache.paths, note.filePath)
    expect(cache.searchIndex.dirty).toBe(true)
    expect(find('externaltoken')).toEqual([id])
    expect(find('newtoken')).toEqual([])
  })

  it('keeps note body intact when renaming a lazy note', () => {
    const storage = createNotesNotesStorage()
    const { id } = storage.createNote({ name: 'Lazy Rename' })
    storage.updateNoteContent(id, 'keep me')

    resyncTwiceForLazyNotes()

    // Переименование сериализует заметку целиком: незагруженное тело должно
    // дочитаться, а не затереться пустым.
    storage.updateNote(id, { name: 'Lazy Renamed' })

    const record = storage.getNoteById(id)
    expect(record?.content).toBe('keep me')

    const notesRootPath = getNotesPaths(tempVaultPath).notesRoot
    const cache = getNotesRuntimeCache(getNotesPaths(tempVaultPath))
    const renamed = cache.notes.find(note => note.id === id)
    const rawSource = fs.readFileSync(
      path.join(notesRootPath, renamed!.filePath),
      'utf8',
    )
    expect(rawSource).toContain('keep me')
  })

  it('applies deferred backlink rewrites after a pending note hydrates', () => {
    const storage = createNotesNotesStorage()
    const { id: targetId } = storage.createNote({ name: 'Target' })
    const { id: linkerId } = storage.createNote({ name: 'Linker' })
    storage.updateNoteContent(linkerId, 'see [[Target]]')

    const paths = getNotesPaths(tempVaultPath)
    const cache = getNotesRuntimeCache(paths)
    const linker = cache.notes.find(note => note.id === linkerId)!
    const linkerFilePath = linker.filePath

    // Имитация недокачанной заметки: тело в облаке на момент rename.
    linker.pendingCloudDownload = true

    storage.updateNote(targetId, { name: 'Renamed Target' })

    // Пока заметка pending, её файл не переписывается.
    const rawBefore = fs.readFileSync(
      path.join(paths.notesRoot, linkerFilePath),
      'utf8',
    )
    expect(rawBefore).toContain('[[Target]]')

    // Гидрация: watcher-путь перечитывает файл и применяет отложенный
    // rewrite.
    syncNoteFileWithDisk(paths, linkerFilePath)

    const rawAfter = fs.readFileSync(
      path.join(paths.notesRoot, linkerFilePath),
      'utf8',
    )
    expect(rawAfter).toContain('[[Renamed Target]]')
    expect(rawAfter).not.toContain('[[Target]]')
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

  it('sorts notes by name and updated date', () => {
    vi.useFakeTimers()

    try {
      const storage = createNotesNotesStorage()

      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const bravo = storage.createNote({ name: 'Bravo' })

      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))
      const alpha = storage.createNote({ name: 'Alpha' })

      vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'))
      storage.updateNote(bravo.id, { description: 'Updated' })

      expect(
        storage.getNotes({ sort: 'name', order: 'ASC' }).map(note => note.id),
      ).toEqual([alpha.id, bravo.id])
      expect(
        storage
          .getNotes({ sort: 'updatedAt', order: 'DESC' })
          .map(note => note.id),
      ).toEqual([bravo.id, alpha.id])
    }
    finally {
      vi.useRealTimers()
    }
  })

  it.each([false, true])(
    'preserves planned links and keeps real reserved renames typed (deferred=%s)',
    (deferred) => {
      const storage = createNotesNotesStorage()
      const target = storage.createNote({ name: 'Old Target' })
      const linker = storage.createNote({ name: 'Linker' })
      const planned = '[[masscode:planned:note|Keep]]'
      storage.updateNoteContent(linker.id, `${planned} [[Old Target]]`)
      const paths = getNotesPaths(tempVaultPath)
      const cached = getNotesRuntimeCache(paths).notes.find(
        note => note.id === linker.id,
      )!
      if (deferred)
        cached.pendingCloudDownload = true
      const cache = getNotesRuntimeCache(paths)
      cache.notes.find(note => note.id === target.id)!.name
        = 'masscode:planned:note'
      // Imported legacy names bypass normal API validation; exercise actual replay.
      rewriteBacklinksAfterNoteUpdate({
        paths,
        state: cache.state,
        notes: cache.notes,
        updatedNoteId: target.id,
        previousName: 'Old Target',
        nextName: 'masscode:planned:note',
        previousFolderId: null,
        nextFolderId: null,
      })
      if (deferred)
        syncNoteFileWithDisk(paths, cached.filePath)
      expect(storage.getNoteById(linker.id)?.content).toBe(
        `${planned} [[note:${target.id}|masscode:planned:note]]`,
      )
    },
  )

  it('rewrites internal links in backlinking notes when a note is renamed', () => {
    const storage = createNotesNotesStorage()

    const target = storage.createNote({ name: 'Old Name' })
    const linker = storage.createNote({ name: 'Linker' })
    const aliasLinker = storage.createNote({ name: 'Alias Linker' })
    const unrelated = storage.createNote({ name: 'Unrelated' })

    storage.updateNoteContent(
      linker.id,
      'See [[Old Name]] [[masscode:planned:note|Future]] for context',
    )
    storage.updateNoteContent(
      aliasLinker.id,
      'See [[old name|the old]] for context',
    )
    storage.updateNoteContent(unrelated.id, 'See [[Other Note]] here')

    storage.updateNote(target.id, { name: 'New Name' })

    expect(storage.getNoteById(linker.id)?.content).toBe(
      'See [[New Name]] [[masscode:planned:note|Future]] for context',
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
