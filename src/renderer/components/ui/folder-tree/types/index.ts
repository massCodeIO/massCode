import type { FoldersItem } from '~/main/api/dto/folders'

export type Position = 'after' | 'before' | 'center'

export interface Node extends FoldersItem {
  children: Node[]
}

export interface Store {
  dragNode?: Node
  dragEnterNode?: Node
  selectedId?: string | number
  highlightedId?: string | number
}
