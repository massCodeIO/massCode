import type { InjectionKey, Ref } from 'vue'
import type { Node } from './types'

export interface FolderTreeInjection {
  clickNode: (id: string | number) => void
  dragNode: (node: Node, target: Node, position: string) => void
  toggleNode: (node: Node) => void
  isHoveredByIdDisabled: Ref<boolean>
  focusHandler?: (isFocused: Ref<boolean>) => void
}

export const folderTreeKeys: InjectionKey<FolderTreeInjection>
  = Symbol('folderTree')
