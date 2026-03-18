import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import {
  addTagToEntity,
  applyEntityUpdateFields,
  createEntityInStateAndDisk,
  deleteEntityFromStateAndDisk,
  deleteTagFromEntity,
  emptyEntityTrashFromStateAndDisk,
  getEntityDeleteCounts,
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

describe('applyEntityUpdateFields', () => {
  it('returns hasAnyField=false when no supported fields are present', () => {
    const entity = {
      description: null as string | null,
      folderId: null as number | null,
      isDeleted: 0,
      isFavorites: 0,
      name: 'Initial',
    }

    const result = applyEntityUpdateFields({
      entity,
      fieldPresence: 'defined',
      folderExists: () => true,
      input: {},
      normalizeFlag: (value, fallback) => value ?? fallback,
      onMissingFolder: () => {
        throw new Error('should not happen')
      },
      resolveName: (inputName, currentName) => inputName ?? currentName,
    })

    expect(result).toEqual({
      hasAnyField: false,
      pathMayChange: false,
      previousIsDeleted: 0,
    })
  })

  it('applies patch fields in defined mode and marks path changes', () => {
    const entity = {
      description: 'Old',
      folderId: null as number | null,
      isDeleted: 0,
      isFavorites: 0,
      name: 'Old name',
    }

    const result = applyEntityUpdateFields({
      entity,
      fieldPresence: 'defined',
      folderExists: folderId => folderId === 42,
      input: {
        description: 'New',
        folderId: 42,
        isDeleted: 1,
        isFavorites: 1,
        name: 'New name',
      },
      normalizeFlag: value => (value ? 1 : 0),
      onMissingFolder: () => {
        throw new Error('should not happen')
      },
      resolveName: inputName => `normalized:${inputName}`,
    })

    expect(result).toEqual({
      hasAnyField: true,
      pathMayChange: true,
      previousIsDeleted: 0,
    })
    expect(entity).toEqual({
      description: 'New',
      folderId: 42,
      isDeleted: 1,
      isFavorites: 1,
      name: 'normalized:New name',
    })
  })

  it('treats explicit undefined as present in "in" mode', () => {
    const entity = {
      description: 'Old',
      folderId: null as number | null,
      isDeleted: 1,
      isFavorites: 1,
      name: 'Current',
    }

    const result = applyEntityUpdateFields({
      entity,
      fieldPresence: 'in',
      folderExists: () => true,
      input: {
        description: undefined,
        isFavorites: undefined,
        name: undefined,
      },
      normalizeFlag: value => value || 0,
      onMissingFolder: () => {
        throw new Error('should not happen')
      },
      resolveName: (inputName, currentName) => inputName || currentName,
    })

    expect(result).toEqual({
      hasAnyField: true,
      pathMayChange: true,
      previousIsDeleted: 1,
    })
    expect(entity).toEqual({
      description: null,
      folderId: null,
      isDeleted: 1,
      isFavorites: 0,
      name: 'Current',
    })
  })
})

describe('getEntityDeleteCounts', () => {
  it('returns active/trash split by default', () => {
    const result = getEntityDeleteCounts([
      { isDeleted: 0 },
      { isDeleted: 1 },
      { isDeleted: 0 },
    ])

    expect(result).toEqual({
      total: 2,
      trash: 1,
    })
  })

  it('can include deleted entities into total', () => {
    const result = getEntityDeleteCounts([{ isDeleted: 0 }, { isDeleted: 1 }], {
      includeDeletedInTotal: true,
    })

    expect(result).toEqual({
      total: 2,
      trash: 1,
    })
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

describe('deleteTagFromEntity', () => {
  it('returns configurable missing relation state when entity or tag is missing', () => {
    const result = deleteTagFromEntity({
      entity: undefined,
      missingRelationFound: true,
      onUpdated: () => {},
      tagExists: false,
      tagId: 1,
    })

    expect(result).toEqual({
      entityFound: false,
      relationFound: true,
      tagFound: false,
      updated: false,
    })
  })

  it('removes an existing relation and reports update', () => {
    const entity = {
      tags: [2, 7, 9] as number[],
      updatedAt: 1,
    }
    let updatesCount = 0

    const result = deleteTagFromEntity({
      entity,
      missingRelationFound: false,
      onUpdated: () => {
        updatesCount += 1
      },
      tagExists: true,
      tagId: 7,
    })

    expect(result).toEqual({
      entityFound: true,
      relationFound: true,
      tagFound: true,
      updated: true,
    })
    expect(entity.tags).toEqual([2, 9])
    expect(updatesCount).toBe(1)
  })

  it('reports relationFound=false when relation does not exist', () => {
    const entity = {
      tags: [1] as number[],
      updatedAt: 1,
    }

    const result = deleteTagFromEntity({
      entity,
      missingRelationFound: false,
      onUpdated: () => {},
      tagExists: true,
      tagId: 2,
    })

    expect(result).toEqual({
      entityFound: true,
      relationFound: false,
      tagFound: true,
      updated: false,
    })
  })
})
