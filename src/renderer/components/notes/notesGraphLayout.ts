import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
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
  x: number
  y: number
  width: number
  height: number
}

export interface GraphLayoutResult {
  width: number
  height: number
  nodes: GraphLayoutNode[]
  edges: GraphEdgeInput[]
}

function getNodeWidth(node: GraphNodeInput, compact: boolean): number {
  const minWidth = compact ? 104 : 144
  const maxWidth = compact ? 156 : 220
  const computedWidth = node.name.length * (compact ? 6 : 7.5) + 44

  return Math.max(minWidth, Math.min(maxWidth, computedWidth))
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
  const estimatedWidth = compact
    ? Math.max(420, Math.sqrt(nodes.length) * 140)
    : Math.max(900, Math.sqrt(nodes.length) * 220)
  const estimatedHeight = compact
    ? Math.max(220, Math.sqrt(nodes.length) * 120)
    : Math.max(560, Math.sqrt(nodes.length) * 180)
  const radius = compact ? 70 : 160

  const layoutNodes: ForceGraphNode[] = nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2

    return {
      ...node,
      height: compact ? 38 : 52,
      width: getNodeWidth(node, compact),
      x: estimatedWidth / 2 + Math.cos(angle) * radius,
      y: estimatedHeight / 2 + Math.sin(angle) * radius,
    }
  })

  const layoutLinks: ForceGraphLink[] = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
  }))

  const simulation = forceSimulation(layoutNodes)
    .force('charge', forceManyBody().strength(compact ? -180 : -320))
    .force('center', forceCenter(estimatedWidth / 2, estimatedHeight / 2))
    .force(
      'collision',
      forceCollide<ForceGraphNode>()
        .radius(
          node =>
            Math.max(node.width, node.height) * 0.55 + (compact ? 8 : 16),
        )
        .strength(1),
    )
    .force(
      'link',
      forceLink<ForceGraphNode, ForceGraphLink>(layoutLinks)
        .id(node => node.id)
        .distance(() => (compact ? 56 : 120))
        .strength(0.18),
    )
    .stop()

  for (let tick = 0; tick < 220; tick++) {
    simulation.tick()
  }

  simulation.stop()

  const padding = compact ? 18 : 32
  const bounds = layoutNodes.reduce(
    (accumulator, node) => ({
      maxX: Math.max(accumulator.maxX, (node.x ?? 0) + node.width / 2),
      maxY: Math.max(accumulator.maxY, (node.y ?? 0) + node.height / 2),
      minX: Math.min(accumulator.minX, (node.x ?? 0) - node.width / 2),
      minY: Math.min(accumulator.minY, (node.y ?? 0) - node.height / 2),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
    },
  )
  const offsetX = padding - bounds.minX
  const offsetY = padding - bounds.minY

  return {
    width: Math.max(320, bounds.maxX - bounds.minX + padding * 2),
    height: Math.max(180, bounds.maxY - bounds.minY + padding * 2),
    nodes: layoutNodes.map(node => ({
      ...node,
      x: (node.x ?? 0) + offsetX,
      y: (node.y ?? 0) + offsetY,
    })),
    edges,
  }
}
