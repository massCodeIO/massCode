import type { FolderLike } from './folderIndex'
import { describe, expect, it } from 'vitest'
import {
  buildFolderPathMap,
  buildPathToFolderIdMap,
  findFolderByIdPure,
  getFolderSiblings,
  getNextFolderOrder,
} from './folderIndex'

function folder(
  id: number,
  name: string,
  parentId: number | null = null,
  orderIndex = 0,
): FolderLike {
  return { id, name, parentId, orderIndex }
}

describe('buildFolderPathMap', () => {
  it('returns empty map for empty array', () => {
    expect(buildFolderPathMap([])).toEqual(new Map())
  })

  it('maps root folders to their name', () => {
    const folders = [folder(1, 'JavaScript'), folder(2, 'Python')]
    const map = buildFolderPathMap(folders)
    expect(map.get(1)).toBe('JavaScript')
    expect(map.get(2)).toBe('Python')
  })

  it('builds nested paths', () => {
    const folders = [
      folder(1, 'Languages'),
      folder(2, 'JavaScript', 1),
      folder(3, 'React', 2),
    ]
    const map = buildFolderPathMap(folders)
    expect(map.get(1)).toBe('Languages')
    expect(map.get(2)).toBe('Languages/JavaScript')
    expect(map.get(3)).toBe('Languages/JavaScript/React')
  })

  it('handles circular references safely', () => {
    const folders = [
      { id: 1, name: 'A', parentId: 2, orderIndex: 0 },
      { id: 2, name: 'B', parentId: 1, orderIndex: 0 },
    ]
    // Should not throw or loop infinitely
    const map = buildFolderPathMap(folders)
    expect(map.size).toBe(2)
  })

  it('handles missing parent gracefully', () => {
    const folders = [folder(1, 'Orphan', 999)]
    const map = buildFolderPathMap(folders)
    // parentId 999 not found, parentPath = '', so path is just name
    expect(map.get(1)).toBe('Orphan')
  })
})

describe('buildPathToFolderIdMap', () => {
  it('inverts the folder path map', () => {
    const folders = [folder(1, 'Languages'), folder(2, 'JavaScript', 1)]
    const map = buildPathToFolderIdMap(folders)
    expect(map.get('Languages')).toBe(1)
    expect(map.get('Languages/JavaScript')).toBe(2)
  })

  it('returns empty map for empty array', () => {
    expect(buildPathToFolderIdMap([])).toEqual(new Map())
  })
})

describe('findFolderByIdPure', () => {
  const folders = [folder(1, 'A'), folder(2, 'B')]

  it('finds existing folder', () => {
    expect(findFolderByIdPure(folders, 1)).toEqual(folders[0])
  })

  it('returns undefined for missing folder', () => {
    expect(findFolderByIdPure(folders, 999)).toBeUndefined()
  })
})

describe('getFolderSiblings', () => {
  const folders = [
    folder(1, 'Root1', null, 0),
    folder(2, 'Root2', null, 1),
    folder(3, 'Child1', 1, 0),
    folder(4, 'Child2', 1, 1),
  ]

  it('returns root siblings', () => {
    const siblings = getFolderSiblings(folders, null)
    expect(siblings.map(f => f.id)).toEqual([1, 2])
  })

  it('returns children of a parent', () => {
    const siblings = getFolderSiblings(folders, 1)
    expect(siblings.map(f => f.id)).toEqual([3, 4])
  })

  it('excludes specified id', () => {
    const siblings = getFolderSiblings(folders, null, 1)
    expect(siblings.map(f => f.id)).toEqual([2])
  })

  it('returns empty array when no siblings', () => {
    expect(getFolderSiblings(folders, 999)).toEqual([])
  })
})

describe('getNextFolderOrder', () => {
  it('returns 0 for empty level', () => {
    expect(getNextFolderOrder([], null)).toBe(0)
  })

  it('returns max + 1 for existing siblings', () => {
    const folders = [
      folder(1, 'A', null, 0),
      folder(2, 'B', null, 5),
      folder(3, 'C', null, 3),
    ]
    expect(getNextFolderOrder(folders, null)).toBe(6)
  })

  it('scopes to correct parent', () => {
    const folders = [folder(1, 'Root', null, 10), folder(2, 'Child', 1, 2)]
    expect(getNextFolderOrder(folders, 1)).toBe(3)
  })
})
