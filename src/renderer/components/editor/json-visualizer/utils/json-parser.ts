import type { Edge, Node } from '@vue-flow/core'
import type { GraphData, NodeData, NodeType, ValueType } from '../types'

let nodeIdCounter = 0

function generateNodeId(): string {
  return `node-${nodeIdCounter++}`
}

function getValueType(value: any): ValueType {
  if (value === null)
    return 'null'
  if (Array.isArray(value))
    return 'array'
  if (typeof value === 'object')
    return 'object'
  return typeof value as ValueType
}

function createNode(
  id: string,
  type: NodeType,
  data: NodeData,
  position: { x: number, y: number } = { x: 0, y: 0 },
): Node<NodeData> {
  return {
    id,
    type,
    data,
    position,
  }
}

function createEdge(sourceId: string, targetId: string): Edge {
  return {
    id: `edge-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    type: 'default',
    animated: false,
  }
}

function parseValue(
  value: any,
  key: string | null = null,
  parentId: string | null = null,
  nodes: Node<NodeData>[] = [],
  edges: Edge[] = [],
): string {
  const nodeId = generateNodeId()
  const valueType = getValueType(value)

  if (valueType === 'object') {
    // Создаем узел для объекта
    const node = createNode(nodeId, 'object', {
      label: key || 'root',
      value,
      type: 'object',
      keysCount: Object.keys(value).length,
    })
    nodes.push(node)

    // Если есть родитель, создаем связь
    if (parentId !== null) {
      edges.push(createEdge(parentId, nodeId))
    }

    // Рекурсивно обрабатываем дочерние элементы
    Object.entries(value).forEach(([childKey, childValue]) => {
      const childType = getValueType(childValue)
      // Создаем узлы только для объектов и массивов
      if (childType === 'object' || childType === 'array') {
        parseValue(childValue, childKey, nodeId, nodes, edges)
      }
    })
  }
  else if (valueType === 'array') {
    // Создаем узел для массива
    const node = createNode(nodeId, 'array', {
      label: key || 'root',
      value,
      type: 'array',
      length: value.length,
    })
    nodes.push(node)

    // Если есть родитель, создаем связь
    if (parentId !== null) {
      edges.push(createEdge(parentId, nodeId))
    }

    // Рекурсивно обрабатываем элементы массива
    value.forEach((item: any, index: number) => {
      const itemType = getValueType(item)
      // Создаем узлы только для объектов и массивов
      if (itemType === 'object' || itemType === 'array') {
        parseValue(item, `[${index}]`, nodeId, nodes, edges)
      }
    })
  }
  // Примитивные значения не создают отдельные узлы

  return nodeId
}

export function parseJsonToGraph(jsonData: any): GraphData {
  // Сброс счетчика для новых узлов
  nodeIdCounter = 0

  const nodes: Node<NodeData>[] = []
  const edges: Edge[] = []

  // Проверяем, является ли корневой элемент объектом или массивом
  const valueType = getValueType(jsonData)

  if (valueType === 'object') {
    // Создаем корневой узел для объекта
    const rootId = generateNodeId()
    const rootNode = createNode(rootId, 'object', {
      label: 'root',
      value: jsonData,
      type: 'object',
      keysCount: Object.keys(jsonData).length,
    })
    nodes.push(rootNode)

    // Парсим дочерние элементы
    Object.entries(jsonData).forEach(([key, value]) => {
      const childType = getValueType(value)
      if (childType === 'object' || childType === 'array') {
        parseValue(value, key, rootId, nodes, edges)
      }
    })
  }
  else if (valueType === 'array') {
    // Создаем корневой узел для массива
    const rootId = generateNodeId()
    const rootNode = createNode(rootId, 'array', {
      label: 'root',
      value: jsonData,
      type: 'array',
      length: jsonData.length,
    })
    nodes.push(rootNode)

    // Парсим элементы массива
    jsonData.forEach((item: any, index: number) => {
      const itemType = getValueType(item)
      if (itemType === 'object' || itemType === 'array') {
        parseValue(item, `[${index}]`, rootId, nodes, edges)
      }
    })
  }
  // Если корень - примитив, то не создаем узлов

  return { nodes, edges }
}
