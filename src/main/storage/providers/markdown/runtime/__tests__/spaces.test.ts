import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ensureFlatSpacesLayout,
  resetMigrationGuardForTesting,
} from '../spaces'

const tempDirs: string[] = []

function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-spaces-'))
  tempDirs.push(tempDir)
  return tempDir
}

afterEach(() => {
  resetMigrationGuardForTesting()

  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop()
    if (tempDir) {
      fs.removeSync(tempDir)
    }
  }
})

describe('ensureFlatSpacesLayout', () => {
  it('can be re-armed in tests after the migration guard was set', () => {
    const vaultPath = createTempDir()
    const firstLegacyCodeRoot = path.join(vaultPath, '__spaces__', 'code')
    fs.ensureDirSync(firstLegacyCodeRoot)
    fs.writeFileSync(path.join(firstLegacyCodeRoot, 'first.md'), '# First')

    ensureFlatSpacesLayout(vaultPath)

    const secondLegacyCodeRoot = path.join(vaultPath, '__spaces__', 'code')
    fs.ensureDirSync(secondLegacyCodeRoot)
    fs.writeFileSync(path.join(secondLegacyCodeRoot, 'second.md'), '# Second')

    resetMigrationGuardForTesting()
    ensureFlatSpacesLayout(vaultPath)

    expect(fs.pathExistsSync(path.join(vaultPath, 'code', 'first.md'))).toBe(
      true,
    )
    expect(fs.pathExistsSync(path.join(vaultPath, 'code', 'second.md'))).toBe(
      true,
    )
    expect(fs.pathExistsSync(path.join(vaultPath, '__spaces__'))).toBe(false)
  })
})
