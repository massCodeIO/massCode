import type { Paths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
})
