import type { InjectionKey, Ref } from 'vue'
import type { Node } from './types'

export interface AppTreeInjection {
  clickNode: (id: string | number) => void
  dragNode: (node: Node, target: Node, position: string) => void
  toggleNode: (node: Node) => void
  contextMenuHandler: () => Promise<boolean>
  isHoveredByIdDisabled: Ref<boolean>
  focusHandler?: (isFocused: Ref<boolean>) => void
}

export const appTreeKeys: InjectionKey<AppTreeInjection> = Symbol('appTree')
