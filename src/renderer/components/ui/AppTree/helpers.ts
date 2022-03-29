import type { Node, Position } from './types'

export function clone (obj: any) {
  return JSON.parse(JSON.stringify(obj))
}

export function guid () {
  return Math.random().toString(36).substring(2, 15)
}

export function deleteNodeById (nodes: Node[] = [], id: string) {
  for (const [index, node] of nodes.entries()) {
    if (node.id === id) {
      nodes.splice(index, 1)
      break
    }
    if (node.children.length) {
      deleteNodeById(node.children, id)
    }
  }
}

export function pushNodeById (nodes: Node[] = [], id: string, payload: Node) {
  for (const [, node] of nodes.entries()) {
    if (node.id === id) {
      node.children.push(payload)
      break
    }

    if (node.children.length) {
      pushNodeById(node.children, id, payload)
    }
  }
}

export function insertNodeById (
  nodes: Node[] = [],
  id: string,
  payload: Node,
  position: Position = 'after'
) {
  for (const [index, node] of nodes.entries()) {
    if (node.id === id) {
      if (position === 'after') {
        console.log('insertNodeById after', node.name, payload.name, index)
        nodes.splice(index + 1, 0, payload)
      }
      if (position === 'before') {
        console.log('insertNodeById before', node.name, payload.name, index)
        nodes.unshift(payload)
      }
      break
    }

    if (node.children.length) {
      insertNodeById(node.children, id, payload, position)
    }
  }
}

export function toggleNodeById (nodes: Node[] = [], id: string) {
  for (const [, node] of nodes.entries()) {
    if (node.id === id) {
      node.isOpen = !node.isOpen
      break
    }

    if (node.children.length) {
      toggleNodeById(node.children, id)
    }
  }
}
