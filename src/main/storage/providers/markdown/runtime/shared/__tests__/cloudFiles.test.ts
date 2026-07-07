import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import { getFileAvailability, isCloudPlaceholderStats } from '../cloudFiles'

const tempDirs: string[] = []

function createTempDir(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-files-'))
  tempDirs.push(dirPath)
  return dirPath
}

afterEach(() => {
  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('getFileAvailability', () => {
  it('reports a regular local file as available', () => {
    const filePath = path.join(createTempDir(), 'note.md')
    fs.writeFileSync(filePath, 'content', 'utf8')

    const availability = getFileAvailability(filePath)

    expect(availability.exists).toBe(true)
    expect(availability.isCloudPlaceholder).toBe(false)
    expect(availability.stats?.size).toBeGreaterThan(0)
  })

  it('reports a missing file as not existing', () => {
    const filePath = path.join(createTempDir(), 'missing.md')

    const availability = getFileAvailability(filePath)

    expect(availability.exists).toBe(false)
    expect(availability.isCloudPlaceholder).toBe(false)
    expect(availability.stats).toBeNull()
  })

  it('does not flag an empty file as placeholder', () => {
    const filePath = path.join(createTempDir(), 'empty.md')
    fs.writeFileSync(filePath, '', 'utf8')

    const availability = getFileAvailability(filePath)

    expect(availability.exists).toBe(true)
    expect(availability.isCloudPlaceholder).toBe(false)
  })

  it('flags a file with size but no allocated blocks as placeholder', () => {
    // Sparse-файл воспроизводит сигнатуру облачного плейсхолдера:
    // ненулевой size при нулевых blocks.
    const filePath = path.join(createTempDir(), 'sparse.md')
    const fd = fs.openSync(filePath, 'w')
    fs.ftruncateSync(fd, 4096)
    fs.closeSync(fd)

    const stats = fs.statSync(filePath)
    // На некоторых ФС sparse-файлы всё же получают блоки: тогда проверяем
    // только сам предикат на синтетическом Stats.
    if (stats.blocks === 0) {
      expect(getFileAvailability(filePath).isCloudPlaceholder).toBe(true)
    }

    expect(
      isCloudPlaceholderStats({
        ...stats,
        blocks: 0,
        isFile: () => true,
        size: 4096,
      }),
    ).toBe(true)
  })
})
