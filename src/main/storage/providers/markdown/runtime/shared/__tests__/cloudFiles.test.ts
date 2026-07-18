import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getFileAvailability,
  isCloudPlaceholderStats,
  markFileReadableDespiteZeroBlocks,
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../cloudFiles'

const tempDirs: string[] = []

function createTempDir(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-files-'))
  tempDirs.push(dirPath)
  return dirPath
}

function createSparseFile(dirPath: string, size = 4096): string {
  // Sparse-файл воспроизводит сигнатуру облачного плейсхолдера:
  // ненулевой size при нулевых blocks.
  const filePath = path.join(dirPath, 'sparse.md')
  const fd = fs.openSync(filePath, 'w')
  fs.ftruncateSync(fd, size)
  fs.closeSync(fd)
  return filePath
}

afterEach(() => {
  setDatalessProbeForTests(null)
  resetCloudFileExemptions()

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

  it('flags a file with placeholder signature when the probe confirms it', () => {
    const filePath = createSparseFile(createTempDir())
    const stats = fs.statSync(filePath)

    if (stats.blocks === 0) {
      setDatalessProbeForTests(() => true)
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

  it('refutes a local sparse file via the dataless probe', () => {
    const filePath = createSparseFile(createTempDir())
    const stats = fs.statSync(filePath)

    if (stats.blocks !== 0) {
      return
    }

    // Локальный файл с сигнатурой плейсхолдера (inline/resident/sparse) не
    // должен навсегда застревать в состоянии «недокачан».
    setDatalessProbeForTests(() => false)
    expect(getFileAvailability(filePath).isCloudPlaceholder).toBe(false)
  })

  it('treats a verified readable zero-block file as available', () => {
    const filePath = createSparseFile(createTempDir())
    const stats = fs.statSync(filePath)

    if (stats.blocks !== 0) {
      return
    }

    setDatalessProbeForTests(() => true)
    expect(getFileAvailability(filePath).isCloudPlaceholder).toBe(true)

    // Ридер успешно прочитал файл: с этого момента он считается локальным,
    // пока не изменится (size + mtime + ctime).
    markFileReadableDespiteZeroBlocks(filePath, stats)
    expect(getFileAvailability(filePath).isCloudPlaceholder).toBe(false)

    const statSpy = vi
      .spyOn(fs, 'statSync')
      .mockReturnValue(Object.assign(stats, { ctimeMs: stats.ctimeMs + 1 }))

    try {
      expect(getFileAvailability(filePath).isCloudPlaceholder).toBe(true)
    }
    finally {
      statSpy.mockRestore()
    }
  })
})
