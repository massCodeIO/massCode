import type { Node, Store } from '../types'
import { computed, reactive } from 'vue'

export const store = reactive<Store>({})

const draggedNodes = computed<Node[]>(() => {
  if (store.dragNodes?.length) {
    return store.dragNodes
  }

  return store.dragNode ? [store.dragNode] : []
})

export const dragNodeIds = computed<(string | number)[]>(() =>
  draggedNodes.value.map(node => node.id),
)

export const dragNodeChildrenIds = computed(() => {
  const ids: (string | number)[] = []

  const findIds = (nodes: Node[]) => {
    nodes.forEach((node) => {
      ids.push(node.id)

      if (node.children?.length) {
        findIds(node.children)
      }
    })
  }

  draggedNodes.value.forEach(node => findIds(node.children || []))

  return ids
})

export const isAllowed = computed(() => {
  if (!draggedNodes.value.length || !store.dragEnterNode)
    return false

  const isSameNode = dragNodeIds.value.includes(store.dragEnterNode.id)
  const isChildrenNode = dragNodeChildrenIds.value.includes(
    store.dragEnterNode!.id,
  )

  return !isSameNode && !isChildrenNode
})

export function useFolders() {
  return {
    dragNodeIds,
    dragNodeChildrenIds,
    isAllowed,
    store,
  }
}
