import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it, vi } from 'vitest'

import { listNoteMarkdownFiles } from './notes'

// Required: listNoteMarkdownFiles imports from modules that transitively
// depend on electron-store and electron via the store module.
vi.mock('electron-store', () => ({
  default: class {
    get() {}
    set() {}
  },
}))
vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
}))

function createTempNotesRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'notes-test-'))
}

describe('listNoteMarkdownFiles', () => {
  it('includes files from .masscode/inbox', () => {
    const root = createTempNotesRoot()
    const inboxDir = path.join(root, '.masscode', 'inbox')
    fs.ensureDirSync(inboxDir)
    fs.writeFileSync(path.join(inboxDir, 'note1.md'), '---\nid: 1\n---\n')
    const files = listNoteMarkdownFiles(root)
    expect(files).toContain('.masscode/inbox/note1.md')
    fs.removeSync(root)
  })

  it('includes files from .masscode/trash', () => {
    const root = createTempNotesRoot()
    const trashDir = path.join(root, '.masscode', 'trash')
    fs.ensureDirSync(trashDir)
    fs.writeFileSync(path.join(trashDir, 'deleted.md'), '---\nid: 2\n---\n')
    const files = listNoteMarkdownFiles(root)
    expect(files).toContain('.masscode/trash/deleted.md')
    fs.removeSync(root)
  })

  it('does not scan .git', () => {
    const root = createTempNotesRoot()
    fs.ensureDirSync(path.join(root, '.git'))
    fs.writeFileSync(path.join(root, '.git', 'HEAD.md'), 'not a note')
    const files = listNoteMarkdownFiles(root)
    expect(files).not.toContain('.git/HEAD.md')
    fs.removeSync(root)
  })

  it('scans regular directories recursively', () => {
    const root = createTempNotesRoot()
    fs.ensureDirSync(path.join(root, 'project', 'sub'))
    fs.writeFileSync(
      path.join(root, 'project', 'sub', 'deep.md'),
      '---\nid: 3\n---\n',
    )
    const files = listNoteMarkdownFiles(root)
    expect(files).toContain('project/sub/deep.md')
    fs.removeSync(root)
  })
})
