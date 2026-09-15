import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { documentFor, markerName, validateRoot } from './common.cjs'

const roots: string[] = []
afterEach(() =>
  roots
    .splice(0)
    .forEach(root => fs.rmSync(root, { recursive: true, force: true })),
)
describe('benchmark dataset and isolation', () => {
  it('reproduces content and varies seed, size and space', () => {
    expect(documentFor('pilot', 1, 'code')).toEqual(
      documentFor('pilot', 1, 'code'),
    )
    expect(documentFor('pilot', 1, 'code')).not.toEqual(
      documentFor('other', 1, 'code'),
    )
    expect(documentFor('pilot', 1, 'notes').body.length).toBe(4096)
    expect(documentFor('pilot', 2, 'code').body.length).toBe(32768)
  })
  it('rejects unmarked and relocated roots and symlinked vaults', () => {
    const root = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-bench-test-')),
    )
    roots.push(root)
    expect(() => validateRoot(root)).toThrow()
    fs.mkdirSync(path.join(root, 'profile'))
    fs.mkdirSync(path.join(root, 'vault'))
    fs.writeFileSync(
      path.join(root, markerName),
      JSON.stringify({ version: 1, root: '/different' }),
    )
    expect(() => validateRoot(root)).toThrow()
    fs.writeFileSync(
      path.join(root, markerName),
      JSON.stringify({ version: 1, root }),
    )
    expect(validateRoot(root).root).toBe(root)
    fs.rmdirSync(path.join(root, 'vault'))
    fs.symlinkSync(path.join(root, 'profile'), path.join(root, 'vault'))
    expect(() => validateRoot(root)).toThrow()
  })
})
