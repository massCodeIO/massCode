import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'

interface GraphNodeInput {
  id: number
  name: string
  incomingLinksCount: number
}

interface GraphEdgeInput {
  source: number
  target: number
}

interface GraphLayoutOptions {
  compact?: boolean
}

interface ForceGraphNode extends GraphLayoutNode {
  index?: number
  vx?: number
  vy?: number
}

interface ForceGraphLink {
  source: number | string | ForceGraphNode
  target: number | string | ForceGraphNode
}

export interface GraphLayoutNode extends GraphNodeInput {
  radius: number
  x: number
  y: number
}

export interface GraphLayoutResult {
  width: number
  height: number
  nodes: GraphLayoutNode[]
  edges: GraphEdgeInput[]
}

interface GraphBounds {
  width: number
  height: number
  maxX: number
  maxY: number
  minX: number
  minY: number
}

export function getNotesGraphNodeRadius(
  connectedNotesCount: number,
  compact = false,
) {
  const minRadius = compact ? 2.6 : 3.2
  const maxRadius = compact ? 8 : 12
  const growth
    = Math.sqrt(Math.max(0, connectedNotesCount)) * (compact ? 1 : 1.35)

  return Math.min(maxRadius, minRadius + growth)
}

export function getNotesGraphConnectedCounts(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
) {
  const connectedIdsByNodeId = new Map<number, Set<number>>(
    nodes.map(node => [node.id, new Set<number>()]),
  )

  edges.forEach((edge) => {
    connectedIdsByNodeId.get(edge.source)?.add(edge.target)
    connectedIdsByNodeId.get(edge.target)?.add(edge.source)
  })

  return new Map(
    [...connectedIdsByNodeId.entries()].map(([nodeId, connectedIds]) => [
      nodeId,
      connectedIds.size,
    ]),
  )
}

export function getNotesGraphBounds(
  nodes: Pick<GraphLayoutNode, 'radius' | 'x' | 'y'>[],
  padding = 24,
): GraphBounds {
  if (!nodes.length) {
    return {
      width: 0,
      height: 0,
      maxX: 0,
      maxY: 0,
      minX: 0,
      minY: 0,
    }
  }

  const bounds = nodes.reduce(
    (accumulator, node) => ({
      maxX: Math.max(accumulator.maxX, node.x + node.radius),
      maxY: Math.max(accumulator.maxY, node.y + node.radius),
      minX: Math.min(accumulator.minX, node.x - node.radius),
      minY: Math.min(accumulator.minY, node.y - node.radius),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
    },
  )

  return {
    ...bounds,
    width: Math.max(240, bounds.maxX - bounds.minX + padding * 2),
    height: Math.max(160, bounds.maxY - bounds.minY + padding * 2),
  }
}

export function buildNotesGraphLayout(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  options: GraphLayoutOptions = {},
): GraphLayoutResult {
  if (!nodes.length) {
    return {
      width: 0,
      height: 0,
      nodes: [],
      edges,
    }
  }

  const compact = Boolean(options.compact)
  const connectedCountsByNodeId = getNotesGraphConnectedCounts(nodes, edges)
  const estimatedWidth = compact
    ? Math.max(340, Math.sqrt(nodes.length) * 96)
    : Math.max(760, Math.sqrt(nodes.length) * 136)
  const estimatedHeight = compact
    ? Math.max(220, Math.sqrt(nodes.length) * 76)
    : Math.max(520, Math.sqrt(nodes.length) * 112)
  const seedRadius = compact ? 52 : 112

  const layoutNodes: ForceGraphNode[] = nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2

    return {
      ...node,
      radius: getNotesGraphNodeRadius(
        connectedCountsByNodeId.get(node.id) ?? 0,
        compact,
      ),
      x: estimatedWidth / 2 + Math.cos(angle) * seedRadius,
      y: estimatedHeight / 2 + Math.sin(angle) * seedRadius,
    }
  })

  const layoutLinks: ForceGraphLink[] = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
  }))

  const simulation = forceSimulation(layoutNodes)
    .force(
      'charge',
      forceManyBody<ForceGraphNode>().strength(
        node => (compact ? -26 : -42) - node.radius * 2,
      ),
    )
    .force('center', forceCenter(estimatedWidth / 2, estimatedHeight / 2))
    .force('x', forceX(estimatedWidth / 2).strength(compact ? 0.03 : 0.02))
    .force('y', forceY(estimatedHeight / 2).strength(compact ? 0.03 : 0.02))
    .force(
      'collision',
      forceCollide<ForceGraphNode>()
        .radius(node => node.radius + (compact ? 3 : 5))
        .strength(0.95),
    )
    .force(
      'link',
      forceLink<ForceGraphNode, ForceGraphLink>(layoutLinks)
        .id(node => node.id)
        .distance(() => (compact ? 28 : 46))
        .strength(compact ? 0.2 : 0.14),
    )
    .stop()

  for (let tick = 0; tick < 260; tick++) {
    simulation.tick()
  }

  simulation.stop()

  const padding = compact ? 14 : 24
  const bounds = getNotesGraphBounds(layoutNodes, padding)
  const offsetX = padding - bounds.minX
  const offsetY = padding - bounds.minY

  return {
    width: bounds.width,
    height: bounds.height,
    nodes: layoutNodes.map(node => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
    })),
    edges,
  }
}
