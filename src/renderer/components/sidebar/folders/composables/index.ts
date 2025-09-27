import type { Node, Store } from '../types'
import { computed, reactive } from 'vue'

export const store = reactive<Store>({})

export const dragNodeChildrenIds = computed(() => {
  const ids: (string | number)[] = []

  const findIds = (nodes: Node[]) => {
    nodes.forEach((i) => {
      ids.push(i.id)

      if (i.children && i.children.length) {
        findIds(i.children)
      }
    })
  }

  findIds(store.dragNode?.children || [])

  return ids
})

export const isAllowed = computed(() => {
  if (!store.dragNode || !store.dragEnterNode)
    return false

  const isSameNode = store.dragNode?.id === store.dragEnterNode?.id
  const isChildrenNode = dragNodeChildrenIds.value.includes(
    store.dragEnterNode!.id,
  )

  return !isSameNode && !isChildrenNode
})

export function useFolders() {
  return {
    dragNodeChildrenIds,
    isAllowed,
    store,
  }
}
