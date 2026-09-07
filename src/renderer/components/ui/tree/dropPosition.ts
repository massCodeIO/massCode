import type { DropPosition, TreeNode } from './types'

export function getDropPosition(
  clientY: number,
  bounds: { top: number, height: number },
  container: boolean,
): DropPosition {
  const offset = clientY - bounds.top
  if (!container)
    return offset < bounds.height / 2 ? 'before' : 'after'
  if (offset < bounds.height * 0.3)
    return 'before'
  if (offset > bounds.height * 0.7)
    return 'after'
  return 'center'
}

// A boundary beside the dragged block is not a new insertion position.
export function isUnchangedDrop(
  siblings: TreeNode[],
  dragged: TreeNode[],
  targetId: TreeNode['id'],
  position: DropPosition,
): boolean {
  if (position === 'center' || !dragged.length)
    return false
  const selected = new Set(dragged.map(node => node.id))
  if (
    dragged.some(node => !siblings.some(sibling => sibling.id === node.id))
  )
    return false
  const remaining = siblings.filter(node => !selected.has(node.id))
  const targetIndex = remaining.findIndex(node => node.id === targetId)
  if (targetIndex < 0)
    return false
  const insertionIndex = targetIndex + (position === 'after' ? 1 : 0)
  remaining.splice(
    insertionIndex,
    0,
    ...siblings.filter(node => selected.has(node.id)),
  )
  return remaining.every((node, index) => node.id === siblings[index]?.id)
}
