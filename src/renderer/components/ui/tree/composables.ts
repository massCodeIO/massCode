import type { DragStore, TreeNode } from './types'
import { computed, reactive } from 'vue'

export const TREE_DND_TYPE = 'application/x-tree-node-ids'

export const dragStore = reactive<DragStore>({})

const draggedNodes = computed<TreeNode[]>(() => {
  if (dragStore.dragNodes?.length) {
    return dragStore.dragNodes
  }

  return dragStore.dragNode ? [dragStore.dragNode] : []
})

export const dragNodeIds = computed<(string | number)[]>(() =>
  draggedNodes.value.map(node => node.id),
)

export const dragNodeChildrenIds = computed(() => {
  const ids: (string | number)[] = []

  const collectIds = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      ids.push(node.id)
      if (node.children?.length) {
        collectIds(node.children)
      }
    })
  }

  draggedNodes.value.forEach(node => collectIds(node.children || []))

  return ids
})

export const isDragAllowed = computed(() => {
  if (!draggedNodes.value.length || !dragStore.dragEnterNode)
    return false

  const isSameNode = dragNodeIds.value.includes(dragStore.dragEnterNode.id)
  const isChildrenNode = dragNodeChildrenIds.value.includes(
    dragStore.dragEnterNode.id,
  )

  return !isSameNode && !isChildrenNode
})

export function flattenTree(nodes: TreeNode[] | undefined): TreeNode[] {
  if (!nodes)
    return []

  const result: TreeNode[] = []

  const walk = (items: TreeNode[]) => {
    items.forEach((node) => {
      result.push(node)
      if (node.children?.length) {
        walk(node.children)
      }
    })
  }

  walk(nodes)
  return result
}
