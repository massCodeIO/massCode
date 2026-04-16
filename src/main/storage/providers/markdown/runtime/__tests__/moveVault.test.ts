import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import { getDirectoryState, moveVault } from '../moveVault'

const tempDirs: string[] = []

function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'move-vault-'))
  tempDirs.push(tempDir)
  return tempDir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop()
    if (tempDir) {
      fs.removeSync(tempDir)
    }
  }
})

describe('getDirectoryState', () => {
  it('returns missing directories as non-existing and empty', () => {
    const missingDir = path.join(createTempDir(), 'missing')

    expect(getDirectoryState(missingDir)).toEqual({
      exists: false,
      isEmpty: true,
    })
  })

  it('detects empty and non-empty directories', () => {
    const emptyDir = createTempDir()
    const fullDir = createTempDir()

    fs.writeFileSync(path.join(fullDir, 'file.md'), '# test')

    expect(getDirectoryState(emptyDir)).toEqual({
      exists: true,
      isEmpty: true,
    })
    expect(getDirectoryState(fullDir)).toEqual({
      exists: true,
      isEmpty: false,
    })
  })
})

describe('moveVault', () => {
  it('moves top-level vault entries into the target directory', () => {
    const sourcePath = createTempDir()
    const targetPath = createTempDir()

    fs.ensureDirSync(path.join(sourcePath, 'code', '.masscode'))
    fs.writeJSONSync(path.join(sourcePath, 'code', '.masscode', 'state.json'), {
      version: 2,
    })
    fs.writeFileSync(path.join(sourcePath, 'code', 'snippet.md'), '# Snippet')
    fs.ensureDirSync(path.join(sourcePath, 'notes'))
    fs.writeFileSync(path.join(sourcePath, 'notes', 'note.md'), '# Note')

    moveVault(sourcePath, targetPath)

    expect(fs.pathExistsSync(path.join(targetPath, 'code', 'snippet.md'))).toBe(
      true,
    )
    expect(fs.pathExistsSync(path.join(targetPath, 'notes', 'note.md'))).toBe(
      true,
    )
    expect(fs.pathExistsSync(sourcePath)).toBe(false)
  })

  it('overwrites existing target entries', () => {
    const sourcePath = createTempDir()
    const targetPath = createTempDir()

    fs.ensureDirSync(path.join(sourcePath, 'code'))
    fs.writeFileSync(path.join(sourcePath, 'code', 'snippet.md'), '# New')
    fs.ensureDirSync(path.join(targetPath, 'code'))
    fs.writeFileSync(path.join(targetPath, 'code', 'snippet.md'), '# Old')

    moveVault(sourcePath, targetPath)

    expect(
      fs.readFileSync(path.join(targetPath, 'code', 'snippet.md'), 'utf8'),
    ).toBe('# New')
  })

  it('rejects an empty target path', () => {
    expect(() => moveVault('/tmp/source', '')).toThrow(
      'Target vault path is required.',
    )
  })

  it('rejects moving into the same directory', () => {
    const sourcePath = createTempDir()

    expect(() => moveVault(sourcePath, sourcePath)).toThrow(
      'Cannot move the vault to the current directory.',
    )
  })

  it('rejects moving into a nested directory', () => {
    const sourcePath = createTempDir()

    expect(() =>
      moveVault(sourcePath, path.join(sourcePath, 'nested')),
    ).toThrow('Cannot move the vault into a nested directory.')
  })

  it('rejects moving into a parent directory of the current vault', () => {
    const parentDir = createTempDir()
    const sourcePath = path.join(parentDir, 'vault')
    fs.ensureDirSync(sourcePath)

    expect(() => moveVault(sourcePath, parentDir)).toThrow(
      'Cannot move the vault into a parent directory of the current vault.',
    )
  })
})
