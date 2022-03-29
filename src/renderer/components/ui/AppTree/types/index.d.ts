export type Position = 'after' | 'before' | 'center'

export interface Node {
  id: string
  name: string
  isOpen: boolean
  children: Node[]
}

export interface Store {
  id: string
  clonedNodes: Node[]
  dragNode?: Node
  dragEnterNode?: Node
  selectedId?: string
}
