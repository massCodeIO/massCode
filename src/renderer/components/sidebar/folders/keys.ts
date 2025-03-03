import type { InjectionKey, Ref } from 'vue'
import type { Node } from './types'

export interface TreeInjection {
  clickNode: (id: string | number) => void
  dragNode: (node: Node, target: Node, position: string) => void
  focusHandler?: (isFocused: Ref<boolean>) => void
  isHoveredByIdDisabled: Ref<boolean>
  toggleNode: (node: Node) => void
}

export const treeKeys: InjectionKey<TreeInjection> = Symbol('tree')
