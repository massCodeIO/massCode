import type { TreeNode } from './types'

export const TREE_ROW_HEIGHT = 23

export interface FlatTreeRow {
  node: TreeNode
  depth: number
  index: number
  siblings: TreeNode[]
  offset: number
}

export function flattenTree(nodes: TreeNode[]): FlatTreeRow[] {
  const rows: FlatTreeRow[] = []
  function visit(siblings: TreeNode[], depth: number) {
    siblings.forEach((node, index) => {
      rows.push({ node, depth, index, siblings, offset: rows.length })
      if (node.isExpanded && node.children)
        visit(node.children, depth + 1)
    })
  }
  visit(nodes, 0)
  return rows
}

export function pinnedRows(
  window: FlatTreeRow[],
  byId: Map<string | number, FlatTreeRow>,
  ids: (string | number | null | undefined)[],
) {
  const rows = new Map(window.map(row => [row.node.id, row]))
  ids.forEach((id) => {
    const row = id == null ? undefined : byId.get(id)
    if (row)
      rows.set(row.node.id, row)
  })
  return [...rows.values()].sort((a, b) => a.offset - b.offset)
}

export function nearestScrollTop(
  index: number,
  scrollTop: number,
  height: number,
) {
  const top = index * TREE_ROW_HEIGHT
  return top < scrollTop
    ? top
    : Math.max(scrollTop, top + TREE_ROW_HEIGHT - height)
}

export function clampScrollTop(
  scrollTop: number,
  count: number,
  height: number,
) {
  return Math.max(0, Math.min(scrollTop, count * TREE_ROW_HEIGHT - height))
}
