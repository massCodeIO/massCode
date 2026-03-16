import type { InjectionKey, Ref } from 'vue'
import type { DropPosition, TreeNode } from './types'

export interface TreeInjection {
  clickNode: (id: string | number, event?: MouseEvent) => void
  dblclickNode: (node: TreeNode) => void
  dragNode: (
    nodes: TreeNode[],
    target: TreeNode,
    position: DropPosition,
  ) => void
  externalDrop: (
    data: DataTransfer,
    target: TreeNode,
    position: DropPosition,
  ) => void
  toggleNode: (node: TreeNode) => void
  contextMenu: (node: TreeNode) => void
  updateLabel: (node: TreeNode, value: string) => void
  cancelEdit: (node: TreeNode) => void
  isHoveredByIdDisabled: Ref<boolean>
  editableId: Ref<string | number | null>
  selectedIds: Ref<(string | number)[]>
  focusedId: Ref<string | number | undefined>
  highlightedIds: Ref<Set<string | number>>
}

export const treeInjectionKey: InjectionKey<TreeInjection> = Symbol('ui-tree')
