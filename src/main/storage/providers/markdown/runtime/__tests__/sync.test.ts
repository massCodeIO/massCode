import type { Paths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stateContentCacheByPath } from '../cache'
import { listEntryFirst } from '../shared/__tests__/listEntryFirst'
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
  const vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'snippets-sync-'))
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
  fileName: string,
  id: number | null,
): void {
  const source = [
    '---',
    ...(id === null ? [] : [`id: ${id}`]),
    `name: ${fileName}`,
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
    'body',
    '```',
    '',
  ].join('\n')

  fs.ensureDirSync(paths.inboxDirPath)
  fs.writeFileSync(path.join(paths.inboxDirPath, fileName), source, 'utf8')
}

afterEach(() => {
  vi.restoreAllMocks()
  resetRuntimeCache()

  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('snippet id allocation on full sync', () => {
  it('does not hand out ids already taken by frontmatter when state.json is missing', () => {
    const paths = createPaths()
    // Порядок обхода не гарантирован; при алфавитном (как на APFS) файлы
    // без id встречаются раньше файлов с явными id.
    writeSnippetFixture(paths, 'a-without-id.md', null)
    writeSnippetFixture(paths, 'b-with-id-1.md', 1)
    writeSnippetFixture(paths, 'c-with-id-2.md', 2)
    writeSnippetFixture(paths, 'd-without-id.md', null)

    const cache = syncRuntimeWithDisk(paths)
    const idByName = new Map(
      cache.state.snippets.map(item => [
        path.posix.basename(item.filePath),
        item.id,
      ]),
    )

    expect(idByName.get('b-with-id-1.md')).toBe(1)
    expect(idByName.get('c-with-id-2.md')).toBe(2)

    const ids = cache.state.snippets.map(item => item.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    expect(cache.snippetById.size).toBe(4)
    expect(cache.state.counters.snippetId).toBe(Math.max(...ids))
  })

  it('keeps ids of indexed snippets and allocates new ones above the counter when state.json exists', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, 'a.md', 5)
    writeSnippetFixture(paths, 'b.md', 7)
    syncRuntimeWithDisk(paths)
    resetRuntimeCache()
    expect(fs.existsSync(paths.statePath)).toBe(true)

    // Порядок обхода не гарантирован; при алфавитном (как на APFS) новый
    // файл без id встречается раньше файла с занятым id.
    writeSnippetFixture(paths, 'c-without-id.md', null)
    writeSnippetFixture(paths, 'd-free-id-3.md', 3)
    writeSnippetFixture(paths, 'e-taken-id-5.md', 5)

    const readSource = (fileName: string) =>
      fs.readFileSync(path.join(paths.inboxDirPath, fileName), 'utf8')
    const unchangedFiles = [
      'a.md',
      'b.md',
      'd-free-id-3.md',
      'e-taken-id-5.md',
    ]
    const sourcesBefore = unchangedFiles.map(readSource)

    const cache = syncRuntimeWithDisk(paths)
    const idByName = new Map(
      cache.state.snippets.map(item => [
        path.posix.basename(item.filePath),
        item.id,
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
    expect(cache.state.counters.snippetId).toBe(9)
    expect(unchangedFiles.map(readSource)).toEqual(sourcesBefore)
  })

  it('keeps the frontmatter id of a snippet renamed outside the app', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, 'a.md', 5)
    syncRuntimeWithDisk(paths)
    resetRuntimeCache()

    const renamedPath = path.join(paths.inboxDirPath, 'b.md')
    const sourceBefore = fs.readFileSync(
      path.join(paths.inboxDirPath, 'a.md'),
      'utf8',
    )
    fs.renameSync(path.join(paths.inboxDirPath, 'a.md'), renamedPath)

    const cache = syncRuntimeWithDisk(paths)

    expect(
      cache.state.snippets.map(({ filePath, id }) => ({ filePath, id })),
    ).toEqual([{ filePath: '.masscode/inbox/b.md', id: 5 }])
    expect(cache.state.counters.snippetId).toBe(5)
    expect(fs.readFileSync(renamedPath, 'utf8')).toBe(sourceBefore)
  })

  it('does not let a copy of an indexed snippet take the id of the original', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, 'Foo.md', 5)
    syncRuntimeWithDisk(paths)
    resetRuntimeCache()

    const originalPath = path.join(paths.inboxDirPath, 'Foo.md')
    const copyPath = path.join(paths.inboxDirPath, 'Foo copy.md')
    fs.copyFileSync(originalPath, copyPath)
    const sourcesBefore = [originalPath, copyPath].map(filePath =>
      fs.readFileSync(filePath, 'utf8'),
    )
    // Сейчас порядок обхода здесь не влияет на путь выполнения (известные
    // пути пропускаются, id индекса собираются до цикла); копия ставится
    // первой лишь как guard на случай смены реализации.
    listEntryFirst('Foo copy.md')

    const cache = syncRuntimeWithDisk(paths)
    const idByName = new Map(
      cache.state.snippets.map(item => [
        path.posix.basename(item.filePath),
        item.id,
      ]),
    )

    expect(idByName.get('Foo.md')).toBe(5)
    expect(idByName.get('Foo copy.md')).toBe(cache.state.counters.snippetId)
    expect(cache.state.counters.snippetId).toBeGreaterThan(5)
    expect(
      [originalPath, copyPath].map(filePath =>
        fs.readFileSync(filePath, 'utf8'),
      ),
    ).toEqual(sourcesBefore)
  })

  it('hands out finite ids when the index has an entry without id', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, 'a.md', 5)
    syncRuntimeWithDisk(paths)
    resetRuntimeCache()

    const rawState = JSON.parse(fs.readFileSync(paths.statePath, 'utf8')) as {
      snippets: Record<string, unknown>[]
    }
    rawState.snippets.push({ filePath: 'ghost.md' })
    fs.writeFileSync(paths.statePath, JSON.stringify(rawState), 'utf8')
    stateContentCacheByPath.delete(paths.statePath)
    resetRuntimeCache()
    writeSnippetFixture(paths, 'b-without-id.md', null)

    const cache = syncRuntimeWithDisk(paths)
    const created = cache.state.snippets.find(
      item => path.posix.basename(item.filePath) === 'b-without-id.md',
    )!

    expect(Number.isInteger(created.id)).toBe(true)
    expect(created.id).toBeGreaterThan(5)
    expect(Number.isFinite(cache.state.counters.snippetId)).toBe(true)
  })
})
