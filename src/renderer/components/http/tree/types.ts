import type { HttpMethod } from '~/main/types/http'

// UI model, deliberately independent of vault paths and API collection metadata.
export interface HttpTreeNode {
  id: string
  parentId: string | null
  kind: 'collection' | 'folder' | 'request'
  name: string
  method?: HttpMethod
  protocol?: 'http' | 'websocket'
  url?: string
  icon?: string | null
  entityId?: number
  pending?: boolean
  dirty?: boolean
  deleted?: boolean
  favorite?: boolean
}

export interface TreeRow {
  node: HttpTreeNode
  depth: number
  position: number
  siblings: number
}

export interface DropTarget {
  id: string
  position: 'before' | 'inside' | 'after'
}

export type MoveError =
  | 'invalid'
  | 'cycle'
  | 'collection'
  | 'conflict'
  | 'sorted'
  | 'unavailable'

export type MoveResult =
  | { ok: true, nodes: HttpTreeNode[], parentId: string | null }
  | { ok: false, error: MoveError }
