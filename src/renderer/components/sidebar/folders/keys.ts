import type { InjectionKey, Ref } from 'vue'
import type { Node, Position } from './types'

export interface TreeInjection {
  clickNode: (id: number, event?: MouseEvent) => void
  dragNode: (nodes: Node[], target: Node, position: Position) => void
  focusHandler?: (isFocused: Ref<boolean>) => void
  isHoveredByIdDisabled: Ref<boolean>
  toggleNode: (node: Node) => void
  contextMenu: (node: Node, event: MouseEvent) => void
}

export const treeKeys: InjectionKey<TreeInjection> = Symbol('tree')
