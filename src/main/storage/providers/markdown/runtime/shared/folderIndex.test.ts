import type { FolderLike } from './folderIndex'
import { describe, expect, it } from 'vitest'
import {
  buildFolderPathMap,
  buildFolderTree,
  buildPathToFolderIdMap,
  collectDescendantIds,
  findFolderByIdPure,
  getFolderSiblings,
  getNextFolderOrder,
  reorderFolderSiblings,
  sortFoldersForTree,
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

describe('sortFoldersForTree', () => {
  it('returns empty array for empty input', () => {
    expect(sortFoldersForTree([])).toEqual([])
  })

  it('sorts siblings by orderIndex', () => {
    const folders = [
      folder(1, 'B', null, 2),
      folder(2, 'A', null, 0),
      folder(3, 'C', null, 1),
    ]
    const sorted = sortFoldersForTree(folders)
    expect(sorted.map(f => f.id)).toEqual([2, 3, 1])
  })

  it('uses id as tiebreaker for equal orderIndex', () => {
    const folders = [
      folder(3, 'C', null, 0),
      folder(1, 'A', null, 0),
      folder(2, 'B', null, 0),
    ]
    const sorted = sortFoldersForTree(folders)
    expect(sorted.map(f => f.id)).toEqual([1, 2, 3])
  })

  it('produces depth-first order', () => {
    const folders = [
      folder(1, 'Root1', null, 0),
      folder(2, 'Root2', null, 1),
      folder(3, 'Child1-of-Root1', 1, 0),
      folder(4, 'Child1-of-Root2', 2, 0),
    ]
    const sorted = sortFoldersForTree(folders)
    expect(sorted.map(f => f.id)).toEqual([1, 3, 2, 4])
  })

  it('treats orphaned folders as roots', () => {
    const folders = [folder(1, 'Root', null, 0), folder(2, 'Orphan', 999, 0)]
    const sorted = sortFoldersForTree(folders)
    expect(sorted.map(f => f.id)).toEqual([1, 2])
    expect(sorted).toHaveLength(2)
  })

  it('handles circular references without infinite loop', () => {
    const folders = [
      { id: 1, name: 'A', parentId: 2, orderIndex: 0 },
      { id: 2, name: 'B', parentId: 1, orderIndex: 0 },
    ]
    const sorted = sortFoldersForTree(folders)
    expect(sorted).toHaveLength(2)
  })
})

describe('buildFolderTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildFolderTree([])).toEqual([])
  })

  it('builds flat list of roots', () => {
    const folders = [folder(1, 'A'), folder(2, 'B')]
    const tree = buildFolderTree(folders)
    expect(tree).toHaveLength(2)
    expect(tree[0].children).toEqual([])
    expect(tree[1].children).toEqual([])
  })

  it('nests children under parents', () => {
    const folders = [
      folder(1, 'Root'),
      folder(2, 'Child1', 1),
      folder(3, 'Child2', 1),
    ]
    const tree = buildFolderTree(folders)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe(1)
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children.map(c => c.id)).toEqual([2, 3])
  })

  it('builds deeply nested tree', () => {
    const folders = [
      folder(1, 'Root'),
      folder(2, 'Child', 1),
      folder(3, 'Grandchild', 2),
    ]
    const tree = buildFolderTree(folders)
    expect(tree[0].children[0].children[0].id).toBe(3)
  })

  it('treats orphaned folders as roots', () => {
    const folders = [folder(1, 'Root'), folder(2, 'Orphan', 999)]
    const tree = buildFolderTree(folders)
    expect(tree).toHaveLength(2)
    expect(tree.map(n => n.id)).toEqual([1, 2])
  })

  it('preserves extra properties on folder type', () => {
    const extended = [
      { id: 1, name: 'Root', parentId: null, orderIndex: 0, extra: 'data' },
    ]
    const tree = buildFolderTree(extended)
    expect((tree[0] as any).extra).toBe('data')
  })
})

describe('collectDescendantIds', () => {
  it('returns empty set for leaf folder', () => {
    const folders = [folder(1, 'Root')]
    expect(collectDescendantIds(folders, 1)).toEqual(new Set())
  })

  it('collects direct children', () => {
    const folders = [
      folder(1, 'Root'),
      folder(2, 'Child1', 1),
      folder(3, 'Child2', 1),
    ]
    expect(collectDescendantIds(folders, 1)).toEqual(new Set([2, 3]))
  })

  it('collects nested descendants recursively', () => {
    const folders = [
      folder(1, 'Root'),
      folder(2, 'Child', 1),
      folder(3, 'Grandchild', 2),
      folder(4, 'GreatGrandchild', 3),
    ]
    expect(collectDescendantIds(folders, 1)).toEqual(new Set([2, 3, 4]))
  })

  it('does not include the parent itself', () => {
    const folders = [folder(1, 'Root'), folder(2, 'Child', 1)]
    const result = collectDescendantIds(folders, 1)
    expect(result.has(1)).toBe(false)
  })

  it('returns empty set for non-existent parent', () => {
    const folders = [folder(1, 'Root')]
    expect(collectDescendantIds(folders, 999)).toEqual(new Set())
  })

  it('handles circular references without infinite loop', () => {
    const folders = [
      { id: 1, name: 'A', parentId: 2, orderIndex: 0 },
      { id: 2, name: 'B', parentId: 1, orderIndex: 0 },
    ]
    const result = collectDescendantIds(folders, 1)
    expect(result).toEqual(new Set([2]))
  })
})

describe('reorderFolderSiblings', () => {
  it('no-ops when nothing changed', () => {
    const folders = [
      folder(1, 'A', null, 0),
      folder(2, 'B', null, 1),
      folder(3, 'C', null, 2),
    ]
    reorderFolderSiblings(folders, 1, null, 0, null, 0)
    expect(folders.map(f => f.orderIndex)).toEqual([0, 1, 2])
  })

  it('shifts siblings down when moving within same parent (move down)', () => {
    const folders = [
      folder(1, 'A', null, 0),
      folder(2, 'B', null, 1),
      folder(3, 'C', null, 2),
      folder(4, 'D', null, 3),
    ]
    reorderFolderSiblings(folders, 1, null, 0, null, 2)
    expect(folders[1].orderIndex).toBe(0)
    expect(folders[2].orderIndex).toBe(1)
    expect(folders[3].orderIndex).toBe(3)
    expect(folders[0].orderIndex).toBe(0)
  })

  it('shifts siblings up when moving within same parent (move up)', () => {
    const folders = [
      folder(1, 'A', null, 0),
      folder(2, 'B', null, 1),
      folder(3, 'C', null, 2),
      folder(4, 'D', null, 3),
    ]
    reorderFolderSiblings(folders, 4, null, 3, null, 1)
    expect(folders[1].orderIndex).toBe(2)
    expect(folders[2].orderIndex).toBe(3)
    expect(folders[0].orderIndex).toBe(0)
  })

  it('adjusts both parents when moving across parents', () => {
    const folders = [
      folder(1, 'A', null, 0),
      folder(2, 'B', null, 1),
      folder(3, 'C', null, 2),
      folder(4, 'X', 10, 0),
      folder(5, 'Y', 10, 1),
    ]
    reorderFolderSiblings(folders, 2, null, 1, 10, 0)
    expect(folders[2].orderIndex).toBe(1)
    expect(folders[0].orderIndex).toBe(0)
    expect(folders[3].orderIndex).toBe(1)
    expect(folders[4].orderIndex).toBe(2)
  })

  it('does not affect folders in unrelated parents', () => {
    const folders = [
      folder(1, 'A', null, 0),
      folder(2, 'B', null, 1),
      folder(3, 'X', 99, 0),
      folder(4, 'Y', 99, 1),
    ]
    reorderFolderSiblings(folders, 1, null, 0, null, 1)
    expect(folders[2].orderIndex).toBe(0)
    expect(folders[3].orderIndex).toBe(1)
  })

  it('does not mutate the moved folder itself', () => {
    const folders = [folder(1, 'A', null, 0), folder(2, 'B', null, 1)]
    reorderFolderSiblings(folders, 1, null, 0, null, 1)
    expect(folders[0].orderIndex).toBe(0)
    expect(folders[0].parentId).toBeNull()
  })
})
