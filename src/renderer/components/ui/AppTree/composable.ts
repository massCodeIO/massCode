import { computed, reactive } from 'vue'
import type { Node, Store, Position } from './types'
import {
  deleteNodeById,
  insertNodeById,
  pushNodeById,
  toggleNodeById
} from './helpers'

export const store = reactive({
  id: 'tree-1',
  clonedNodes: []
} as Store)

export const dragNodeChildrenIds = computed(() => {
  const ids: string[] = []

  const findIds = (nodes: Node[]) => {
    nodes.forEach(i => {
      ids.push(i.id)

      if (i.children.length) {
        findIds(i.children)
      }
    })
  }

  findIds(store.dragNode?.children || [])

  return ids
})

export const isAllowed = computed(() => {
  if (!store.dragNode) return false

  const isSameNode = store.dragNode?.id === store.dragEnterNode?.id
  const isChildrenNode = dragNodeChildrenIds.value.includes(
    store.dragEnterNode!.id
  )

  return !isSameNode && !isChildrenNode
})

export const insertNodeByPosition = (
  position: Position,
  to: Node,
  from: Node
) => {
  if (!isAllowed.value) return

  deleteNodeById(store.clonedNodes, from.id)
  insertNodeById(store.clonedNodes, to.id, from, position)
}

export const pushNode = (to: Node, from: Node) => {
  if (!isAllowed.value) return

  deleteNodeById(store.clonedNodes, from.id)
  pushNodeById(store.clonedNodes, to.id, from)
}

export const toggleNode = (id: string) => {
  toggleNodeById(store.clonedNodes, id)
}
