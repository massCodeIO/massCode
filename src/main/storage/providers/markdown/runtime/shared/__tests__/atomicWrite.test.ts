import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeFileAtomicSync } from '../atomicWrite'

const isWindows = process.platform === 'win32'

let tempDir = ''

function listEntries(): string[] {
  return fs.readdirSync(tempDir).sort()
}

// Симулирует ENOSPC посреди записи: половина содержимого успевает лечь
// в файл, затем запись падает.
function mockPartialWrite() {
  const writeFileSync = fs.writeFileSync.bind(fs)

  return vi
    .spyOn(fs, 'writeFileSync')
    .mockImplementation((file, data, options) => {
      const text = String(data)
      writeFileSync(file, text.slice(0, text.length / 2), options)
      throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' })
    })
}

describe('writeFileAtomicSync', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-atomic-write-'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.removeSync(tempDir)
  })

  it('replaces the file content and leaves no temp file', () => {
    const filePath = path.join(tempDir, 'Note.md')
    fs.writeFileSync(filePath, 'old')

    writeFileAtomicSync(filePath, 'new')

    expect(fs.readFileSync(filePath, 'utf8')).toBe('new')
    expect(listEntries()).toEqual(['Note.md'])
  })

  it('creates a missing file', () => {
    const filePath = path.join(tempDir, 'Fresh.md')

    writeFileAtomicSync(filePath, 'body')

    expect(fs.readFileSync(filePath, 'utf8')).toBe('body')
    expect(listEntries()).toEqual(['Fresh.md'])
  })

  it('keeps the original file intact when the write fails midway', () => {
    const filePath = path.join(tempDir, 'Note.md')
    fs.writeFileSync(filePath, 'original body')
    mockPartialWrite()

    expect(() => writeFileAtomicSync(filePath, 'replacement body')).toThrow(
      'ENOSPC',
    )

    expect(fs.readFileSync(filePath, 'utf8')).toBe('original body')
    expect(listEntries()).toEqual(['Note.md'])
  })

  it('keeps the original file and removes the temp file when rename fails', () => {
    const filePath = path.join(tempDir, 'Note.md')
    fs.writeFileSync(filePath, 'original body')
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('EIO'), { code: 'EIO' })
    })

    expect(() => writeFileAtomicSync(filePath, 'replacement body')).toThrow(
      'EIO',
    )

    expect(fs.readFileSync(filePath, 'utf8')).toBe('original body')
    expect(listEntries()).toEqual(['Note.md'])
  })

  it('writes the temp file next to the target with a non-markdown name', () => {
    const filePath = path.join(tempDir, 'Note.md')
    fs.writeFileSync(filePath, 'old')
    const rename = vi.spyOn(fs, 'renameSync')

    writeFileAtomicSync(filePath, 'new')

    const [tempPath] = rename.mock.calls[0] as [string, string]
    expect(path.dirname(tempPath)).toBe(tempDir)
    expect(path.basename(tempPath)).toMatch(/^\.Note\.md\.[0-9a-f]+\.tmp$/)
  })

  it.skipIf(isWindows)('preserves the permissions of the existing file', () => {
    const filePath = path.join(tempDir, 'Note.md')
    fs.writeFileSync(filePath, 'old')
    fs.chmodSync(filePath, 0o600)

    writeFileAtomicSync(filePath, 'new')

    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600)
  })

  it.skipIf(isWindows)('writes through a symlink without replacing it', () => {
    const realPath = path.join(tempDir, 'Real.md')
    const linkPath = path.join(tempDir, 'Link.md')
    fs.writeFileSync(realPath, 'old')
    fs.symlinkSync(realPath, linkPath)

    writeFileAtomicSync(linkPath, 'new')

    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true)
    expect(fs.readFileSync(realPath, 'utf8')).toBe('new')
    expect(listEntries()).toEqual(['Link.md', 'Real.md'])
  })

  describe('on Windows', () => {
    const originalPlatform = process.platform

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
    })

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('falls back to an in-place write when the target is locked', () => {
      const filePath = path.join(tempDir, 'Note.md')
      fs.writeFileSync(filePath, 'old')
      vi.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw Object.assign(new Error('EPERM'), { code: 'EPERM' })
      })

      writeFileAtomicSync(filePath, 'new')

      expect(fs.readFileSync(filePath, 'utf8')).toBe('new')
      expect(listEntries()).toEqual(['Note.md'])
    })

    it('does not fall back on unrelated rename errors', () => {
      const filePath = path.join(tempDir, 'Note.md')
      fs.writeFileSync(filePath, 'old')
      vi.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw Object.assign(new Error('EIO'), { code: 'EIO' })
      })

      expect(() => writeFileAtomicSync(filePath, 'new')).toThrow('EIO')
      expect(fs.readFileSync(filePath, 'utf8')).toBe('old')
    })
  })
})
