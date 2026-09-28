import type { Paths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureSnippetContentLoaded } from '../snippets'
import { loadState } from '../state'
import { resetRuntimeCache, syncRuntimeWithDisk } from '../sync'

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

vi.mock('../../../../../store', () => ({
  store: {
    preferences: {
      get: () => undefined,
    },
  },
}))

vi.mock('../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

const tempDirs: string[] = []

function createPaths(): Paths {
  const vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-index-'))
  tempDirs.push(vaultPath)
  const metaDirPath = path.join(vaultPath, '.masscode')

  return {
    inboxDirPath: path.join(metaDirPath, 'inbox'),
    metaDirPath,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, 'trash'),
    vaultPath,
  }
}

function writeSnippetFixture(
  paths: Paths,
  relativePath: string,
  id: number,
  name: string,
  body = 'body',
): string {
  const absolutePath = path.join(paths.vaultPath, relativePath)
  const source = [
    '---',
    `id: ${id}`,
    `name: ${name}`,
    'createdAt: 1700000000000',
    'updatedAt: 1700000000000',
    'contents:',
    '  - id: 1',
    '    label: Fragment 1',
    '    language: plain_text',
    '---',
    '',
    '## Fragment: Fragment 1',
    '```plain_text',
    body,
    '```',
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
  paths: Paths,
  absolutePath: string,
  mutate: (source: string) => string,
): void {
  const source = fs.readFileSync(absolutePath, 'utf8')
  fs.writeFileSync(absolutePath, mutate(source), 'utf8')

  const stats = fs.statSync(absolutePath)
  const persisted = fs.readJsonSync(paths.statePath) as {
    snippets: { meta?: { mtimeMs: number, size: number } }[]
  }
  persisted.snippets[0].meta!.mtimeMs = stats.mtimeMs
  persisted.snippets[0].meta!.size = stats.size
  fs.writeJsonSync(paths.statePath, persisted)
}

afterEach(() => {
  resetRuntimeCache()

  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('snippet metadata index', () => {
  it('fills index metadata on first scan and persists it in state.json', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, '.masscode/inbox/first.md', 1, 'First')

    syncRuntimeWithDisk(paths)

    const persisted = fs.readJsonSync(paths.statePath) as {
      snippets: { id: number, meta?: { name: string, mtimeMs: number } }[]
      version: number
    }

    expect(persisted.version).toBe(3)
    expect(persisted.snippets[0].meta?.name).toBe('First')
    expect(persisted.snippets[0].meta?.mtimeMs).toBeGreaterThan(0)

    // Схема записи строгая: посторонние поля не персистятся.
    expect(Object.keys(persisted.snippets[0]).sort()).toEqual([
      'filePath',
      'id',
      'meta',
    ])
  })

  it('builds untouched snippets from the index without reading files', () => {
    const paths = createPaths()
    const absolutePath = writeSnippetFixture(
      paths,
      '.masscode/inbox/lazy.md',
      1,
      'Lazy',
    )

    // Первый скан читает файл и заполняет индекс.
    syncRuntimeWithDisk(paths)

    // Имя в файле меняется, но сигнатура индекса совпадает со stat: если
    // повторный скан отдаёт старое имя, файл действительно не читался.
    mutateFileKeepingIndexSignature(paths, absolutePath, source =>
      source.replace('name: Lazy', 'name: Hack'))

    resetRuntimeCache()
    const cache = syncRuntimeWithDisk(paths)
    const snippet = cache.snippets.find(item => item.id === 1)

    expect(snippet?.name).toBe('Lazy')
    expect(snippet?.contents[0]?.value).toBeNull()
  })

  it('lazily loads fragment bodies on demand', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, '.masscode/inbox/demand.md', 1, 'Demand')

    syncRuntimeWithDisk(paths)
    resetRuntimeCache()
    const cache = syncRuntimeWithDisk(paths)
    const snippet = cache.snippets.find(item => item.id === 1)

    expect(snippet?.contents[0]?.value).toBeNull()
    expect(ensureSnippetContentLoaded(paths, snippet!)).toBe(true)
    expect(snippet?.contents[0]?.value).toBe('body')
  })

  it('re-reads files whose stat signature changed', () => {
    const paths = createPaths()
    const absolutePath = writeSnippetFixture(
      paths,
      '.masscode/inbox/changed.md',
      1,
      'Before',
    )

    syncRuntimeWithDisk(paths)

    // Обычная внешняя правка: mtime меняется, файл перечитывается.
    writeSnippetFixture(paths, '.masscode/inbox/changed.md', 1, 'After')
    fs.utimesSync(absolutePath, new Date(), new Date(Date.now() + 5_000))

    resetRuntimeCache()
    const cache = syncRuntimeWithDisk(paths)
    const snippet = cache.snippets.find(item => item.id === 1)

    expect(snippet?.name).toBe('After')
    expect(snippet?.contents[0]?.value).toBe('body')
  })

  it('backfills metadata for legacy v2 index entries', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, '.masscode/inbox/legacy.md', 5, 'Legacy')

    // v2-индекс: записи без метаданных, только { id, filePath }.
    fs.ensureDirSync(paths.metaDirPath)
    fs.writeJsonSync(paths.statePath, {
      counters: { contentId: 0, folderId: 0, snippetId: 5, tagId: 0 },
      folderUi: {},
      snippets: [{ filePath: '.masscode/inbox/legacy.md', id: 5 }],
      tags: [],
      version: 2,
    })

    const cache = syncRuntimeWithDisk(paths)
    const snippet = cache.snippets.find(item => item.id === 5)

    // Файл прочитан один раз (тело на месте), а индекс дозаполнен.
    expect(snippet?.name).toBe('Legacy')
    expect(snippet?.contents[0]?.value).toBe('body')

    const state = loadState(paths)
    expect(state.snippets[0].meta?.name).toBe('Legacy')
    expect(state.version).toBe(3)
  })
})
