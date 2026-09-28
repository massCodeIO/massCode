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
  it('reproduces a varied corpus with Unicode, languages, and large documents', () => {
    const samples = Array.from({ length: 6 }, (_, index) =>
      documentFor('pilot', index, 'code', 'varied'))
    expect(new Set(samples.map(sample => sample.language)).size).toBe(6)
    expect(
      samples.every(
        sample =>
          sample.body.includes('needle')
          && sample.body.includes('Поиск 東京 😀'),
      ),
    ).toBe(true)
    expect(samples[0].body.length).toBeGreaterThanOrEqual(131072)
    expect(samples[0]).toEqual(documentFor('pilot', 0, 'code', 'varied'))
    expect(samples[0]).not.toEqual(documentFor('other', 0, 'code', 'varied'))
    expect(samples[5].body).toContain('```typescript')
    expect(() => documentFor('pilot', 0, 'code', 'unknown')).toThrow()
  })

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
