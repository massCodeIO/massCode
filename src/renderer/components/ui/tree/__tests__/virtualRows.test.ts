import type { TreeNode } from '../types'
import { describe, expect, it } from 'vitest'
import {
  clampScrollTop,
  flattenTree,
  nearestScrollTop,
  pinnedRows,
  TREE_ROW_HEIGHT,
} from '../virtualRows'

describe('virtual tree rows', () => {
  it('preserves nodes, sibling arrays and expanded preorder', () => {
    const children = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]
    const nodes: TreeNode[] = [
      { id: 'folder', label: 'Folder', children, isExpanded: true },
      { id: 'last', label: 'Last' },
    ]
    const rows = flattenTree(nodes)
    expect(
      rows.map(row => [row.node.id, row.depth, row.index, row.offset]),
    ).toEqual([
      ['folder', 0, 0, 0],
      ['a', 1, 0, 1],
      ['b', 1, 1, 2],
      ['last', 0, 1, 3],
    ])
    expect(rows[1].node).toBe(children[0])
    expect(rows[1].siblings).toBe(children)
    nodes[0].isExpanded = false
    expect(flattenTree(nodes).map(row => row.node.id)).toEqual([
      'folder',
      'last',
    ])
  })

  it('bounds a 10000 row window plus edit and actual drag source pins without duplicate identities', () => {
    const rows = flattenTree(
      Array.from({ length: 10000 }, (_, id) => ({ id, label: String(id) })),
    )
    const byId = new Map(rows.map(row => [row.node.id, row]))
    const window = rows.slice(5000, 5040)
    const rendered = pinnedRows(window, byId, [12, 9999])
    expect(rendered).toHaveLength(42)
    expect(rendered[0]).toBe(rows[12])
    expect(rendered.at(-1)).toBe(rows[9999])
    expect(pinnedRows(window, byId, [5001, 5001])).toEqual(window)
    expect(pinnedRows(window, byId, ['missing', undefined])).toEqual(window)
    expect(
      pinnedRows(rows.slice(0, 40), byId, [12, 9999]).find(
        row => row.node.id === 12,
      ),
    ).toBe(rendered[0])
  })

  it('scrolls nearest and clamps after filtering without negative offsets', () => {
    expect(nearestScrollTop(10, 0, 100)).toBe(11 * TREE_ROW_HEIGHT - 100)
    expect(nearestScrollTop(10, 220, 100)).toBe(220)
    expect(nearestScrollTop(0, 220, 100)).toBe(0)
    expect(clampScrollTop(200000, 5, 100)).toBe(15)
    expect(clampScrollTop(100, 0, 100)).toBe(0)
  })
})
