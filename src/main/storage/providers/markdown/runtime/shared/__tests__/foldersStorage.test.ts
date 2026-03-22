import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildFolderPathMap,
  type FolderLike,
  getNextFolderOrder,
} from '../folderIndex'
import {
  applyFolderParentAndOrder,
  assertFolderMoveTargetValid,
  createFolderInStateAndDisk,
  moveFolderDirectoryOnDisk,
  replaceSubtreePathPrefix,
  resolveFolderUpdateTargets,
  updateChildEntityPaths,
} from '../foldersStorage'

interface TestFolder extends FolderLike {
  createdAt: number
  updatedAt: number
}

function makeFolder(
  id: number,
  name: string,
  parentId: number | null = null,
  orderIndex = 0,
): TestFolder {
  return {
    createdAt: 0,
    id,
    name,
    orderIndex,
    parentId,
    updatedAt: 0,
  }
}

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop()
    if (tempDir) {
      fs.removeSync(tempDir)
    }
  }
})

function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folders-storage-'))
  tempDirs.push(tempDir)
  return tempDir
}

describe('createFolderInStateAndDisk', () => {
  it('creates folder on disk and updates state counters', () => {
    const rootPath = createTempDir()
    const state = {
      counters: { folderId: 1 },
      folders: [makeFolder(1, 'Root')],
    }

    const created = createFolderInStateAndDisk({
      buildFolderPathMap: current => buildFolderPathMap(current.folders),
      createFolder: ({ id, name, now, orderIndex, parentId }) => ({
        createdAt: now,
        id,
        name,
        orderIndex,
        parentId,
        updatedAt: now,
      }),
      getNextFolderOrder: (current, parentId) =>
        getNextFolderOrder(current.folders, parentId),
      name: 'Child',
      parentId: 1,
      rootPath,
      state,
    })

    expect(created.id).toBe(2)
    expect(created.folderRelativePath).toBe('Root/Child')
    expect(state.counters.folderId).toBe(2)
    expect(state.folders).toHaveLength(2)
    expect(fs.pathExistsSync(path.join(rootPath, 'Root', 'Child'))).toBe(true)
  })
})

describe('assertFolderMoveTargetValid', () => {
  it('throws when target parent does not exist', () => {
    const folders = [makeFolder(1, 'Root')]

    expect(() => assertFolderMoveTargetValid(folders, 1, 999)).toThrow(
      'FOLDER_NOT_FOUND',
    )
  })

  it('throws when moving folder into its own subtree', () => {
    const folders = [
      makeFolder(1, 'Root'),
      makeFolder(2, 'Child', 1),
      makeFolder(3, 'Grandchild', 2),
    ]

    expect(() => assertFolderMoveTargetValid(folders, 1, 3)).toThrow(
      'INVALID_NAME',
    )
  })

  it('allows moving to null root parent', () => {
    const folders = [makeFolder(1, 'Root')]

    expect(() => assertFolderMoveTargetValid(folders, 1, null)).not.toThrow()
  })
})

describe('applyFolderParentAndOrder', () => {
  it('reorders siblings and updates target folder position', () => {
    const folders = [
      makeFolder(1, 'A', null, 0),
      makeFolder(2, 'B', null, 1),
      makeFolder(3, 'C', null, 2),
    ]

    const result = applyFolderParentAndOrder(folders, folders[0], null, 2)

    expect(result.parentChanged).toBe(false)
    expect(folders[0].orderIndex).toBe(2)
    expect(folders[1].orderIndex).toBe(0)
    expect(folders[2].orderIndex).toBe(1)
  })

  it('returns parentChanged when moving to another parent', () => {
    const folders = [
      makeFolder(1, 'Root A', null, 0),
      makeFolder(2, 'Root B', null, 1),
      makeFolder(3, 'Child', 1, 0),
    ]

    const result = applyFolderParentAndOrder(folders, folders[2], 2, 0)

    expect(result.parentChanged).toBe(true)
    expect(folders[2].parentId).toBe(2)
    expect(folders[2].orderIndex).toBe(0)
  })
})

describe('moveFolderDirectoryOnDisk', () => {
  it('moves folder directory to target path', () => {
    const rootPath = createTempDir()
    fs.ensureDirSync(path.join(rootPath, 'A', 'Old'))
    fs.writeFileSync(path.join(rootPath, 'A', 'Old', 'note.md'), 'test')

    moveFolderDirectoryOnDisk(rootPath, 'A/Old', 'B/New')

    expect(fs.pathExistsSync(path.join(rootPath, 'A', 'Old'))).toBe(false)
    expect(fs.pathExistsSync(path.join(rootPath, 'B', 'New', 'note.md'))).toBe(
      true,
    )
  })

  it('ignores empty relative paths', () => {
    const rootPath = createTempDir()
    fs.ensureDirSync(path.join(rootPath, 'A'))

    moveFolderDirectoryOnDisk(rootPath, '', 'B')

    expect(fs.pathExistsSync(path.join(rootPath, 'A'))).toBe(true)
  })
})

describe('replaceSubtreePathPrefix', () => {
  it('replaces folder prefix for nested file path', () => {
    const updatedPath = replaceSubtreePathPrefix(
      'Old/Child/note.md',
      'Old',
      'New',
    )

    expect(updatedPath).toBe('New/Child/note.md')
  })

  it('keeps path unchanged when file is outside moved subtree', () => {
    const updatedPath = replaceSubtreePathPrefix('Other/note.md', 'Old', 'New')

    expect(updatedPath).toBe('Other/note.md')
  })
})

describe('updateChildEntityPaths', () => {
  it('updates only selected entities and reports path changes', () => {
    const entries = [
      { filePath: 'Old/a.md', folderId: 1 },
      { filePath: 'Other/b.md', folderId: 2 },
    ]
    const changed: Array<{ previousPath: string, nextPath: string }> = []

    updateChildEntityPaths({
      entries,
      getNextPath: entry =>
        replaceSubtreePathPrefix(entry.filePath, 'Old', 'New'),
      onPathUpdated: (_, previousPath, nextPath) => {
        changed.push({ nextPath, previousPath })
      },
      shouldUpdate: entry => entry.folderId === 1,
    })

    expect(entries[0].filePath).toBe('New/a.md')
    expect(entries[1].filePath).toBe('Other/b.md')
    expect(changed).toEqual([
      { nextPath: 'New/a.md', previousPath: 'Old/a.md' },
    ])
  })
})

describe('resolveFolderUpdateTargets', () => {
  it('uses folder values when input does not provide parent or order', () => {
    const folder = makeFolder(1, 'Root', null, 3)

    const result = resolveFolderUpdateTargets(folder, {})

    expect(result).toEqual({
      targetOrderIndex: 3,
      targetParentId: null,
    })
  })

  it('normalizes order index and parent from input', () => {
    const folder = makeFolder(1, 'Root', 4, 7)

    const result = resolveFolderUpdateTargets(
      folder,
      {
        orderIndex: '12',
        parentId: 2,
      },
      (value, fallback) => {
        const numericValue = Number(value)
        return Number.isFinite(numericValue) ? numericValue : fallback
      },
    )

    expect(result).toEqual({
      targetOrderIndex: 12,
      targetParentId: 2,
    })
  })
})
