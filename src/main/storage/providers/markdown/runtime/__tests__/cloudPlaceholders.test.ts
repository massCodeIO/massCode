import type { Paths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { runtimeRef } from '../cache'
import { setDatalessProbeForTests } from '../shared/cloudFiles'
import { writeSnippetToFile } from '../snippets'
import {
  refreshPendingSnippetFiles,
  resetRuntimeCache,
  syncRuntimeWithDisk,
} from '../sync'

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
  const vaultPath = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cloud-placeholders-'),
  )
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
    'body',
    '```',
    '',
  ].join('\n')

  fs.ensureDirSync(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, source, 'utf8')

  return absolutePath
}

// Sparse-файл воспроизводит сигнатуру облачного плейсхолдера:
// ненулевой size при нулевых blocks (проверяется в cloudFiles.test.ts).
function makeSparsePlaceholder(absolutePath: string, size = 4096): void {
  fs.removeSync(absolutePath)
  const fd = fs.openSync(absolutePath, 'w')
  fs.ftruncateSync(fd, size)
  fs.closeSync(fd)
}

function hasPlaceholderSignature(absolutePath: string): boolean {
  const stats = fs.statSync(absolutePath)
  return stats.size > 0 && stats.blocks === 0
}

beforeEach(() => {
  // Sparse-файлы имитируют плейсхолдеры по сигнатуре (size > 0, blocks 0),
  // но не имеют флага SF_DATALESS: точная проверка подменяется, чтобы
  // симуляция работала как настоящий облачный плейсхолдер.
  setDatalessProbeForTests(() => true)
})

afterEach(() => {
  setDatalessProbeForTests(null)
  resetRuntimeCache()
  vi.mocked(enqueueCloudDownload).mockClear()

  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('cloud placeholder handling in code runtime', () => {
  it('keeps known placeholder snippets in the list without reading them', () => {
    const paths = createPaths()
    const localPath = writeSnippetFixture(
      paths,
      '.masscode/inbox/local.md',
      1,
      'Local',
    )
    const placeholderPath = writeSnippetFixture(
      paths,
      '.masscode/inbox/remote.md',
      2,
      'Remote',
    )

    // Первый скан регистрирует оба файла в state как обычные.
    syncRuntimeWithDisk(paths)

    // Провайдер "выгрузил" второй файл: содержимое заменяется на placeholder.
    makeSparsePlaceholder(placeholderPath)
    if (!hasPlaceholderSignature(placeholderPath)) {
      // На ФС без поддержки sparse-файлов сценарий невоспроизводим.
      return
    }

    resetRuntimeCache()
    const cache = syncRuntimeWithDisk(paths)

    const local = cache.snippets.find(snippet => snippet.id === 1)
    const remote = cache.snippets.find(snippet => snippet.id === 2)

    expect(local?.pendingCloudDownload).toBeUndefined()
    expect(local?.contents[0]?.value).toBe('body')

    expect(remote).toBeDefined()
    expect(remote?.pendingCloudDownload).toBe(true)
    expect(remote?.name).toBe('remote')
    expect(remote?.contents).toEqual([])

    expect(vi.mocked(enqueueCloudDownload)).toHaveBeenCalledWith(
      placeholderPath,
    )

    // Файл остался нетронутым: скан не материализовал и не переписал его.
    expect(hasPlaceholderSignature(placeholderPath)).toBe(true)
    expect(fs.statSync(localPath).size).toBeGreaterThan(0)
  })

  it('does not register unknown placeholder files until they are downloaded', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, '.masscode/inbox/known.md', 1, 'Known')
    syncRuntimeWithDisk(paths)

    // Файл с другого устройства: есть в каталоге, но содержимое в облаке.
    const unknownPath = path.join(paths.vaultPath, '.masscode/inbox/new.md')
    makeSparsePlaceholder(unknownPath)
    if (!hasPlaceholderSignature(unknownPath)) {
      return
    }

    resetRuntimeCache()
    const cache = syncRuntimeWithDisk(paths)

    // Без frontmatter id регистрировать нельзя: id был бы угадан и после
    // докачки разошёлся бы с настоящим id из frontmatter.
    expect(
      cache.state.snippets.some(entry => entry.filePath.endsWith('new.md')),
    ).toBe(false)
    expect(vi.mocked(enqueueCloudDownload)).toHaveBeenCalledWith(unknownPath)
  })

  it('never writes into a placeholder file', () => {
    const paths = createPaths()
    const placeholderPath = writeSnippetFixture(
      paths,
      '.masscode/inbox/pending.md',
      3,
      'Pending',
    )
    makeSparsePlaceholder(placeholderPath)
    if (!hasPlaceholderSignature(placeholderPath)) {
      return
    }

    writeSnippetToFile(paths, {
      contents: [],
      createdAt: 1700000000000,
      description: null,
      filePath: '.masscode/inbox/pending.md',
      folderId: null,
      id: 3,
      isDeleted: 0,
      isFavorites: 0,
      name: 'pending',
      pendingCloudDownload: true,
      tags: [],
      updatedAt: 1700000000000,
    })

    // Содержимое в облаке ещё не скачано: запись уничтожила бы его.
    expect(hasPlaceholderSignature(placeholderPath)).toBe(true)
    expect(vi.mocked(enqueueCloudDownload)).toHaveBeenCalledWith(
      placeholderPath,
    )
  })

  it('clears the pending flag and fills content once the file is hydrated', () => {
    const paths = createPaths()
    const filePath = writeSnippetFixture(
      paths,
      '.masscode/inbox/remote.md',
      7,
      'Remote',
    )

    // Файл сперва зарегистрирован в state обычным сканом.
    syncRuntimeWithDisk(paths)

    // Затем провайдер выгрузил его: повторный скан отдаёт placeholder-запись.
    makeSparsePlaceholder(filePath)
    if (!hasPlaceholderSignature(filePath)) {
      return
    }

    resetRuntimeCache()
    const cache = syncRuntimeWithDisk(paths)
    const pending = cache.snippets.find(snippet => snippet.id === 7)
    expect(pending?.pendingCloudDownload).toBe(true)
    expect(pending?.contents).toEqual([])

    // Облако материализовало файл (в реальности — без смены mtime, поэтому
    // watcher-событие не приходит и снятие флага делает self-heal).
    writeSnippetFixture(paths, '.masscode/inbox/remote.md', 7, 'Remote')
    expect(hasPlaceholderSignature(filePath)).toBe(false)

    const result = refreshPendingSnippetFiles(paths)
    expect(result.remaining).toBe(0)

    const refreshed = runtimeRef.cache?.snippets.find(
      snippet => snippet.id === 7,
    )
    expect(refreshed?.pendingCloudDownload).toBeFalsy()
    expect(refreshed?.contents[0]?.value).toBe('body')
  })
})
