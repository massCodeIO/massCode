import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import {
  depthOfRelativePath,
  listMarkdownFiles,
  normalizeDirectoryPath,
  toPosixPath,
} from './path'

describe('toPosixPath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(toPosixPath('foo\\bar\\baz')).toBe('foo/bar/baz')
  })

  it('leaves forward slashes unchanged', () => {
    expect(toPosixPath('foo/bar/baz')).toBe('foo/bar/baz')
  })

  it('handles empty string', () => {
    expect(toPosixPath('')).toBe('')
  })
})

describe('depthOfRelativePath', () => {
  it('returns 0 for empty string', () => {
    expect(depthOfRelativePath('')).toBe(0)
  })

  it('returns 1 for single segment', () => {
    expect(depthOfRelativePath('folder')).toBe(1)
  })

  it('returns correct depth for nested path', () => {
    expect(depthOfRelativePath('a/b/c')).toBe(3)
  })
})

describe('normalizeDirectoryPath', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeDirectoryPath('')).toBe('')
  })

  it('returns empty string for dot', () => {
    expect(normalizeDirectoryPath('.')).toBe('')
  })

  it('converts backslashes', () => {
    expect(normalizeDirectoryPath('foo\\bar')).toBe('foo/bar')
  })

  it('returns forward-slash path unchanged', () => {
    expect(normalizeDirectoryPath('foo/bar')).toBe('foo/bar')
  })
})

describe('listMarkdownFiles', () => {
  const META = '.masscode'
  const INBOX = 'inbox'
  const TRASH = 'trash'
  let tmpDir: string

  afterEach(() => {
    if (tmpDir) {
      fs.removeSync(tmpDir)
    }
  })

  function createTmpDir(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-path-test-'))
    return tmpDir
  }

  it('returns empty array for non-existent directory', () => {
    const result = listMarkdownFiles('/non/existent', META, INBOX, TRASH)
    expect(result).toEqual([])
  })

  it('returns empty array for empty directory', () => {
    const root = createTmpDir()
    const result = listMarkdownFiles(root, META, INBOX, TRASH)
    expect(result).toEqual([])
  })

  it('finds markdown files at root level', () => {
    const root = createTmpDir()
    fs.writeFileSync(path.join(root, 'note.md'), 'content')
    fs.writeFileSync(path.join(root, 'readme.txt'), 'text')

    const result = listMarkdownFiles(root, META, INBOX, TRASH)
    expect(result).toEqual(['note.md'])
  })

  it('finds files in inbox and trash inside meta dir', () => {
    const root = createTmpDir()
    const inboxPath = path.join(root, META, INBOX)
    const trashPath = path.join(root, META, TRASH)
    fs.ensureDirSync(inboxPath)
    fs.ensureDirSync(trashPath)
    fs.writeFileSync(path.join(inboxPath, 'inbox-note.md'), 'content')
    fs.writeFileSync(path.join(trashPath, 'trash-note.md'), 'content')

    const result = listMarkdownFiles(root, META, INBOX, TRASH)
    expect(result.sort()).toEqual([
      `${META}/${INBOX}/inbox-note.md`,
      `${META}/${TRASH}/trash-note.md`,
    ])
  })

  it('skips hidden directories other than meta dir', () => {
    const root = createTmpDir()
    const gitDir = path.join(root, '.git')
    fs.ensureDirSync(gitDir)
    fs.writeFileSync(path.join(gitDir, 'config.md'), 'content')

    const result = listMarkdownFiles(root, META, INBOX, TRASH)
    expect(result).toEqual([])
  })

  it('skips hidden files', () => {
    const root = createTmpDir()
    fs.writeFileSync(path.join(root, '.hidden.md'), 'content')

    const result = listMarkdownFiles(root, META, INBOX, TRASH)
    expect(result).toEqual([])
  })

  it('recurses into regular subdirectories', () => {
    const root = createTmpDir()
    const subDir = path.join(root, 'folder', 'subfolder')
    fs.ensureDirSync(subDir)
    fs.writeFileSync(path.join(subDir, 'deep.md'), 'content')

    const result = listMarkdownFiles(root, META, INBOX, TRASH)
    expect(result).toEqual(['folder/subfolder/deep.md'])
  })

  it('respects skipDirNames at root level', () => {
    const root = createTmpDir()
    const spacesDir = path.join(root, '__spaces__')
    fs.ensureDirSync(spacesDir)
    fs.writeFileSync(path.join(spacesDir, 'file.md'), 'content')
    fs.writeFileSync(path.join(root, 'root.md'), 'content')

    const result = listMarkdownFiles(
      root,
      META,
      INBOX,
      TRASH,
      new Set(['__spaces__']),
    )
    expect(result).toEqual(['root.md'])
  })

  it('does not skip skipDirNames in subdirectories', () => {
    const root = createTmpDir()
    const nestedDir = path.join(root, 'folder', '__spaces__')
    fs.ensureDirSync(nestedDir)
    fs.writeFileSync(path.join(nestedDir, 'file.md'), 'content')

    const result = listMarkdownFiles(
      root,
      META,
      INBOX,
      TRASH,
      new Set(['__spaces__']),
    )
    expect(result).toEqual(['folder/__spaces__/file.md'])
  })

  it('does not enter other subdirectories of meta dir', () => {
    const root = createTmpDir()
    const otherMeta = path.join(root, META, 'other')
    fs.ensureDirSync(otherMeta)
    fs.writeFileSync(path.join(otherMeta, 'file.md'), 'content')

    const result = listMarkdownFiles(root, META, INBOX, TRASH)
    expect(result).toEqual([])
  })
})
