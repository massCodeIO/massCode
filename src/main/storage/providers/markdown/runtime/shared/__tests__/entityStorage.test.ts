import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteEntityFromStateAndDisk,
  emptyEntityTrashFromStateAndDisk,
} from '../entityStorage'

const tempDirs: string[] = []

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'entity-storage-'))
  tempDirs.push(root)
  return root
}

afterEach(() => {
  while (tempDirs.length) {
    const tempDir = tempDirs.pop()
    if (tempDir) {
      fs.removeSync(tempDir)
    }
  }
})

describe('deleteEntityFromStateAndDisk', () => {
  it('returns deleted=false when state entry does not exist', () => {
    const rootPath = createTempRoot()
    const stateEntities: Array<{ id: number, filePath: string }> = []
    const runtimeEntities: Array<{ id: number, filePath: string }> = []

    const result = deleteEntityFromStateAndDisk({
      id: 1,
      rootPath,
      runtimeEntities,
      stateEntities,
    })

    expect(result).toEqual({ deleted: false })
  })

  it('removes file and entries from state and runtime', () => {
    const rootPath = createTempRoot()
    fs.ensureDirSync(path.join(rootPath, '.masscode', 'inbox'))
    fs.writeFileSync(
      path.join(rootPath, '.masscode', 'inbox', 'one.md'),
      '# one',
    )

    const stateEntities = [
      { filePath: '.masscode/inbox/one.md', id: 1 },
      { filePath: '.masscode/inbox/two.md', id: 2 },
    ]
    const runtimeEntities = [
      { filePath: '.masscode/inbox/one.md', id: 1 },
      { filePath: '.masscode/inbox/two.md', id: 2 },
    ]

    const result = deleteEntityFromStateAndDisk({
      id: 1,
      rootPath,
      runtimeEntities,
      stateEntities,
    })

    expect(result).toEqual({ deleted: true })
    expect(
      fs.pathExistsSync(path.join(rootPath, '.masscode', 'inbox', 'one.md')),
    ).toBe(false)
    expect(stateEntities.map(entity => entity.id)).toEqual([2])
    expect(runtimeEntities.map(entity => entity.id)).toEqual([2])
  })
})

describe('emptyEntityTrashFromStateAndDisk', () => {
  it('returns deletedCount=0 when trash is empty', () => {
    const rootPath = createTempRoot()
    const stateEntities = [{ filePath: '.masscode/inbox/one.md', id: 1 }]
    const runtimeEntities = [
      { filePath: '.masscode/inbox/one.md', id: 1, isDeleted: 0 },
    ]

    const result = emptyEntityTrashFromStateAndDisk({
      rootPath,
      runtimeEntities,
      stateEntities,
    })

    expect(result).toEqual({ deletedCount: 0 })
  })

  it('removes deleted files and keeps non-deleted entries', () => {
    const rootPath = createTempRoot()
    fs.ensureDirSync(path.join(rootPath, '.masscode', 'inbox'))
    fs.ensureDirSync(path.join(rootPath, '.masscode', 'trash'))
    fs.writeFileSync(
      path.join(rootPath, '.masscode', 'inbox', 'keep.md'),
      '# keep',
    )
    fs.writeFileSync(
      path.join(rootPath, '.masscode', 'trash', 'drop.md'),
      '# drop',
    )

    const stateEntities = [
      { filePath: '.masscode/inbox/keep.md', id: 1 },
      { filePath: '.masscode/trash/drop.md', id: 2 },
    ]
    const runtimeEntities = [
      { filePath: '.masscode/inbox/keep.md', id: 1, isDeleted: 0 },
      { filePath: '.masscode/trash/drop.md', id: 2, isDeleted: 1 },
    ]

    const result = emptyEntityTrashFromStateAndDisk({
      rootPath,
      runtimeEntities,
      stateEntities,
    })

    expect(result).toEqual({ deletedCount: 1 })
    expect(
      fs.pathExistsSync(path.join(rootPath, '.masscode', 'trash', 'drop.md')),
    ).toBe(false)
    expect(
      fs.pathExistsSync(path.join(rootPath, '.masscode', 'inbox', 'keep.md')),
    ).toBe(true)
    expect(stateEntities.map(entity => entity.id)).toEqual([1])
    expect(runtimeEntities.map(entity => entity.id)).toEqual([1])
  })
})
