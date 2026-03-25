export interface TreeNode {
  id: string | number
  label: string
  children?: TreeNode[]
  isExpanded?: boolean
}

export type DropPosition = 'after' | 'before' | 'center'

export interface DragStore {
  dragNode?: TreeNode
  dragNodes?: TreeNode[]
  dragEnterNode?: TreeNode
}
