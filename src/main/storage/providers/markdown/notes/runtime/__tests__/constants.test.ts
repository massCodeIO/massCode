import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import { getNotesPaths } from '../constants'

const tempDirs: string[] = []

function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-paths-'))
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

describe('getNotesPaths', () => {
  it('migrates nested notes space from __spaces__/code to root __spaces__/notes', () => {
    const vaultPath = createTempDir()
    const legacyNotesRoot = path.join(
      vaultPath,
      '__spaces__',
      'code',
      '__spaces__',
      'notes',
    )
    fs.ensureDirSync(path.join(legacyNotesRoot, '.masscode'))
    fs.writeFileSync(
      path.join(legacyNotesRoot, '.masscode', 'state.json'),
      '{"version":2}',
      'utf8',
    )
    fs.ensureDirSync(path.join(legacyNotesRoot, 'Folder'))
    fs.writeFileSync(path.join(legacyNotesRoot, 'Folder', 'note.md'), '# Note')

    const notesPaths = getNotesPaths(vaultPath)

    expect(notesPaths.notesRoot).toBe(
      path.join(vaultPath, '__spaces__', 'notes'),
    )
    expect(
      fs.pathExistsSync(path.join(notesPaths.notesRoot, 'Folder', 'note.md')),
    ).toBe(true)
    expect(fs.pathExistsSync(legacyNotesRoot)).toBe(false)
  })

  it('merges nested notes space into existing root notes space', () => {
    const vaultPath = createTempDir()
    const notesRoot = path.join(vaultPath, '__spaces__', 'notes')
    fs.ensureDirSync(path.join(notesRoot, '.masscode'))
    fs.writeFileSync(
      path.join(notesRoot, '.masscode', 'state.json'),
      '{"version":2}',
      'utf8',
    )
    fs.writeFileSync(path.join(notesRoot, 'root-note.md'), '# Root')

    const legacyNotesRoot = path.join(
      vaultPath,
      '__spaces__',
      'code',
      '__spaces__',
      'notes',
    )
    fs.ensureDirSync(legacyNotesRoot)
    fs.writeFileSync(path.join(legacyNotesRoot, 'legacy-note.md'), '# Legacy')

    const notesPaths = getNotesPaths(vaultPath)

    expect(
      fs.pathExistsSync(path.join(notesPaths.notesRoot, 'root-note.md')),
    ).toBe(true)
    expect(
      fs.pathExistsSync(path.join(notesPaths.notesRoot, 'legacy-note.md')),
    ).toBe(true)
    expect(fs.pathExistsSync(legacyNotesRoot)).toBe(false)
  })
})
