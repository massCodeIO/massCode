import type { Paths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { createFoldersStorage } from '../../storages/folders'
import { createSnippetsStorage } from '../../storages/snippets'
import { runtimeRef } from '../cache'
import { getPaths } from '../paths'
import {
  getFileAvailability,
  setDatalessProbeForTests,
} from '../shared/cloudFiles'
import { assertNoUnknownDomainFiles } from '../shared/foldersStorage'
import { ensureSnippetContentLoaded, writeSnippetToFile } from '../snippets'
import { saveState } from '../state'
import {
  refreshPendingSnippetFiles,
  resetRuntimeCache,
  syncRuntimeWithDisk,
  syncSnippetFileWithDisk,
} from '../sync'

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

const storageMock = vi.hoisted(() => ({ vaultPath: '' }))

vi.mock('../../../../../store', () => ({
  store: {
    preferences: {
      get: (key: string) =>
        key === 'storage.vaultPath' ? storageMock.vaultPath : undefined,
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

function createStoragePaths(): Paths {
  const vaultPath = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cloud-placeholder-storage-'),
  )
  tempDirs.push(vaultPath)
  storageMock.vaultPath = vaultPath

  return getPaths(vaultPath)
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
  storageMock.vaultPath = ''
  setDatalessProbeForTests(null)
  resetRuntimeCache()
  vi.mocked(enqueueCloudDownload).mockClear()

  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('cloud placeholder handling in code runtime', () => {
  it('allows immediate content write and rename of an app-written file', () => {
    const paths = createStoragePaths()
    const targetPath = path.join(paths.vaultPath, '.masscode/inbox/Renamed.md')
    const statSync = fs.statSync.bind(fs)
    const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
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

    try {
      const storage = createSnippetsStorage()
      const { id } = storage.createSnippet({ name: 'Resident' })
      expect(() =>
        storage.createSnippetContent(id, {
          label: 'Fragment 1',
          language: 'plain_text',
          value: 'body',
        }),
      ).not.toThrow()

      resetRuntimeCache()
      syncRuntimeWithDisk(paths)
      resetRuntimeCache()
      const lazyCache = syncRuntimeWithDisk(paths)
      const lazySnippet = lazyCache.snippets.find(
        snippet => snippet.id === id,
      )
      expect(lazySnippet?.contents[0]?.value).toBeNull()

      expect(() =>
        storage.updateSnippet(id, { name: 'Renamed' }),
      ).not.toThrow()

      expect(fs.readFileSync(targetPath, 'utf8')).toContain('body')
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('keeps local folder contents available without rewriting placeholders', () => {
    const paths = createStoragePaths()
    const statSync = fs.statSync.bind(fs)
    const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
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
    const foldersStorage = createFoldersStorage()
    const storage = createSnippetsStorage()
    const folder = foldersStorage.createFolder({ name: 'Folder' })
    let localId = 0
    let placeholderId = 0
    let placeholderSourcePath = ''

    try {
      localId = storage.createSnippet({
        folderId: folder.id,
        name: 'Resident',
      }).id
      storage.createSnippetContent(localId, {
        label: 'Fragment 1',
        language: 'plain_text',
        value: 'local body',
      })

      placeholderId = storage.createSnippet({
        folderId: folder.id,
        name: 'Pending',
      }).id
      storage.createSnippetContent(placeholderId, {
        label: 'Fragment 1',
        language: 'plain_text',
        value: 'remote body',
      })
      const placeholder = runtimeRef.cache!.snippets.find(
        item => item.id === placeholderId,
      )!
      placeholderSourcePath = path.join(paths.vaultPath, placeholder.filePath)

      makeSparsePlaceholder(placeholderSourcePath)
      if (!hasPlaceholderSignature(placeholderSourcePath)) {
        return
      }

      expect(foldersStorage.deleteFolder(folder.id).deleted).toBe(true)

      const local = runtimeRef.cache!.snippets.find(
        item => item.id === localId,
      )!
      const pending = runtimeRef.cache!.snippets.find(
        item => item.id === placeholderId,
      )!
      const localTargetPath = path.join(paths.vaultPath, local.filePath)
      const placeholderTargetPath = path.join(
        paths.vaultPath,
        pending.filePath,
      )

      expect(getFileAvailability(localTargetPath).isCloudPlaceholder).toBe(
        false,
      )
      expect(hasPlaceholderSignature(placeholderTargetPath)).toBe(true)
      expect(fs.statSync(placeholderTargetPath).size).toBe(4096)
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('keeps a committed write successful when its follow-up stat fails', () => {
    const paths = createPaths()
    const snippetPath = path.join(paths.vaultPath, '.masscode/inbox/saved.md')
    const statSync = fs.statSync.bind(fs)
    const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
      if (filePath === snippetPath && fs.existsSync(snippetPath)) {
        throw new Error('post-write stat failed')
      }

      return statSync(filePath)
    })

    try {
      expect(() =>
        writeSnippetToFile(paths, {
          contents: [
            {
              id: 1,
              label: 'Fragment 1',
              language: 'plain_text',
              value: 'saved body',
            },
          ],
          createdAt: 1700000000000,
          description: null,
          filePath: '.masscode/inbox/saved.md',
          folderId: null,
          id: 2,
          isDeleted: 0,
          isFavorites: 0,
          name: 'Saved',
          tags: [],
          updatedAt: 1700000000000,
        }),
      ).not.toThrow()
    }
    finally {
      statSpy.mockRestore()
    }

    expect(fs.readFileSync(snippetPath, 'utf8')).toContain('saved body')
  })

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

    // Нетронутый файл строится из индекса метаданных без чтения: тело
    // остаётся ленивым и дочитывается по требованию.
    expect(local?.contents[0]?.value).toBeNull()
    expect(ensureSnippetContentLoaded(paths, local!)).toBe(true)
    expect(local?.contents[0]?.value).toBe('body')

    // Плейсхолдер с известными метаданными — полноценная запись списка:
    // имя и структура фрагментов из индекса, тела ждут докачки.
    expect(remote).toBeDefined()
    expect(remote?.pendingCloudDownload).toBe(true)
    expect(remote?.name).toBe('Remote')
    expect(remote?.contents).toEqual([
      {
        id: 1,
        label: 'Fragment 1',
        language: 'plain_text',
        value: null,
      },
    ])

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

    // Содержимое в облаке ещё не скачано: запись уничтожила бы его, а тихий
    // пропуск дал бы ложный success — правка молча потерялась бы при докачке.
    expect(() =>
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
      }),
    ).toThrow(/CLOUD_FILE_NOT_DOWNLOADED/)

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
    expect(pending?.contents[0]?.value).toBeNull()

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

describe('assertNoUnknownDomainFiles', () => {
  it('rejects folder deletion when an unindexed placeholder is inside', () => {
    const paths = createPaths()
    const folderRelativePath = 'Folder'
    const knownPath = writeSnippetFixture(paths, 'Folder/known.md', 1, 'Known')

    // Файл с другого устройства: есть в каталоге, содержимое в облаке,
    // записи в state нет. Рекурсивное удаление каталога уничтожило бы его.
    const unknownPath = path.join(paths.vaultPath, 'Folder/unknown.md')
    makeSparsePlaceholder(unknownPath)
    if (!hasPlaceholderSignature(unknownPath)) {
      return
    }

    expect(() =>
      assertNoUnknownDomainFiles(
        paths.vaultPath,
        [folderRelativePath],
        new Set(['Folder/known.md']),
      ),
    ).toThrow(/CLOUD_FILE_NOT_DOWNLOADED/)
    expect(vi.mocked(enqueueCloudDownload)).toHaveBeenCalledWith(unknownPath)

    // Известные записи (в том числе pending) не блокируют удаление: их
    // переносят в trash отдельные preflight'ы вызывающих.
    makeSparsePlaceholder(knownPath)
    expect(() =>
      assertNoUnknownDomainFiles(
        paths.vaultPath,
        [folderRelativePath],
        new Set(['Folder/known.md', 'Folder/unknown.md']),
      ),
    ).not.toThrow()
  })

  it('rejects any unknown markdown file, not only cloud placeholders', () => {
    const paths = createPaths()

    // Обычный локальный .md без записи в runtime (сбой чтения при скане или
    // файл создан между сканом и удалением) тоже не должен уничтожаться.
    writeSnippetFixture(paths, 'Folder/orphan.md', 9, 'Orphan')

    expect(() =>
      assertNoUnknownDomainFiles(paths.vaultPath, ['Folder'], new Set()),
    ).toThrow(/CLOUD_FILE_NOT_DOWNLOADED/)

    // Не-доменные файлы (ассеты, служебные) удаление не блокируют.
    fs.removeSync(path.join(paths.vaultPath, 'Folder/orphan.md'))
    fs.writeFileSync(path.join(paths.vaultPath, 'Folder/asset.png'), 'bin')
    expect(() =>
      assertNoUnknownDomainFiles(paths.vaultPath, ['Folder'], new Set()),
    ).not.toThrow()
  })
})

describe('provisional state during cloud hydration', () => {
  it('never persists provisional state over the real index', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, '.masscode/inbox/local.md', 1, 'Local')
    const cache = syncRuntimeWithDisk(paths)
    const persistedContent = fs.readFileSync(paths.statePath, 'utf8')

    // Состояние помечено как provisional (state.json «ещё не докачан»):
    // даже изменённый индекс не должен доехать до диска.
    cache.state.provisional = true
    cache.state.snippets.push({ filePath: 'phantom.md', id: 99 })
    saveState(paths, cache.state, { immediate: true })

    expect(fs.readFileSync(paths.statePath, 'utf8')).toBe(persistedContent)
  })

  it('skips watcher registration of files while state is provisional', () => {
    const paths = createPaths()
    writeSnippetFixture(paths, '.masscode/inbox/known.md', 1, 'Known')
    const cache = syncRuntimeWithDisk(paths)
    cache.state.provisional = true

    writeSnippetFixture(paths, '.masscode/inbox/fresh.md', 2, 'Fresh')
    const result = syncSnippetFileWithDisk(paths, '.masscode/inbox/fresh.md')

    // Событие не эскалирует в полный ресинк и не регистрирует файл:
    // его подберёт сверка после докачки state.
    expect(result).toBe(cache)
    expect(
      cache.state.snippets.some(entry => entry.filePath.endsWith('fresh.md')),
    ).toBe(false)
  })
})
