import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import {
  addTagToEntity,
  createEntityInStateAndDisk,
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

describe('createEntityInStateAndDisk', () => {
  it('throws through onFolderNotFound when folder is missing', () => {
    const entities: Array<{ id: number, name: string }> = []
    const error = new Error('FOLDER_NOT_FOUND:Folder not found')

    expect(() =>
      createEntityInStateAndDisk({
        createEntity: ({ id, name }) => ({ id, name }),
        entities,
        folderId: 10,
        hasFolder: () => false,
        name: 'Note',
        nextId: () => 1,
        onFolderNotFound: () => {
          throw error
        },
        persistEntity: () => {},
      }),
    ).toThrow(error)
  })

  it('creates entity, persists it and appends to runtime list', () => {
    const entities: Array<{ id: number, name: string }> = []
    const persisted: Array<{ id: number, name: string }> = []
    let idCounter = 0

    const result = createEntityInStateAndDisk({
      createEntity: ({ id, name }) => ({ id, name }),
      entities,
      folderId: null,
      hasFolder: () => true,
      name: 'Snippet',
      nextId: () => {
        idCounter += 1
        return idCounter
      },
      onFolderNotFound: () => {
        throw new Error('should not happen')
      },
      persistEntity: (entity) => {
        persisted.push(entity)
      },
    })

    expect(result).toEqual({ id: 1 })
    expect(entities).toEqual([{ id: 1, name: 'Snippet' }])
    expect(persisted).toEqual([{ id: 1, name: 'Snippet' }])
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

describe('addTagToEntity', () => {
  it('returns not found flags when entity or tag is missing', () => {
    const result = addTagToEntity({
      entity: undefined,
      onUpdated: () => {},
      tagExists: false,
      tagId: 1,
    })

    expect(result).toEqual({
      entityFound: false,
      tagFound: false,
      updated: false,
    })
  })

  it('adds tag exactly once and reports update status', () => {
    const entity = {
      tags: [] as number[],
      updatedAt: 1,
    }
    let updatesCount = 0

    const first = addTagToEntity({
      entity,
      onUpdated: () => {
        updatesCount += 1
      },
      tagExists: true,
      tagId: 7,
    })
    const second = addTagToEntity({
      entity,
      onUpdated: () => {
        updatesCount += 1
      },
      tagExists: true,
      tagId: 7,
    })

    expect(first).toEqual({
      entityFound: true,
      tagFound: true,
      updated: true,
    })
    expect(second).toEqual({
      entityFound: true,
      tagFound: true,
      updated: false,
    })
    expect(entity.tags).toEqual([7])
    expect(updatesCount).toBe(1)
  })
})
