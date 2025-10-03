import type { Edge, Node } from '@vue-flow/core'

export interface NodeData {
  label: string
  value: any
  type: 'object' | 'array' | 'primitive'
  keysCount?: number
  length?: number
}

export interface GraphData {
  nodes: Node<NodeData>[]
  edges: Edge[]
}

export type NodeType = 'object' | 'array' | 'primitive'
export type ValueType =
  | 'null'
  | 'array'
  | 'object'
  | 'string'
  | 'number'
  | 'boolean'
  | 'undefined'
export type LayoutDirection = 'TB' | 'LR'
