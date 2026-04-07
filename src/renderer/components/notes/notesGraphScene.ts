import { getNotesGraphBounds } from './notesGraphLayout'

export interface GraphSceneNodeLike {
  id: number
  incomingLinksCount: number
  name: string
  radius: number
  x: number
  y: number
}

export interface GraphSceneLabel {
  fontSize: number
  id: number
  isActive: boolean
  lineHeight: number
  lines: string[]
  textAnchor: 'end' | 'middle' | 'start'
  x: number
  y: number
}

export interface GraphSceneBoundsLike {
  height: number
  maxX: number
  maxY: number
  minX: number
  minY: number
  width: number
}

export interface GraphSceneViewportPadding {
  bottom: number
  left: number
  right: number
  top: number
}

interface GraphSceneViewportFocusPoint {
  x: number
  y: number
}

interface BuildGraphSceneLabelsOptions {
  activeId: number | null
  compact: boolean
  neighborIds: Set<number>
  nodes: GraphSceneNodeLike[]
  pan: {
    x: number
    y: number
  }
  zoom: number
}

interface GetGraphSceneViewportTransformOptions {
  bounds: GraphSceneBoundsLike
  compact: boolean
  focusPoint?: GraphSceneViewportFocusPoint
  height: number
  padding?: Partial<GraphSceneViewportPadding>
  width: number
}

interface GetGraphSceneResetViewportTransformOptions {
  compact: boolean
  height: number
  nodes: GraphSceneNodeLike[]
  padding?: Partial<GraphSceneViewportPadding>
  width: number
}

interface ShouldAutoResetGraphSceneViewportOptions {
  isAutoResetEnabled: boolean
  isNodeDragging: boolean
  isPanning: boolean
}

function wrapGraphSceneLabelText(text: string, maxCharactersPerLine: number) {
  const normalized = text.trim().replace(/\s+/g, ' ')

  if (!normalized) {
    return []
  }

  const words = normalized.split(' ')
  const lines: string[] = []
  let currentLine = ''

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word

    if (currentLine && nextLine.length > maxCharactersPerLine) {
      lines.push(currentLine)
      currentLine = word
      return
    }

    currentLine = nextLine
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function getGraphSceneLabelHeight(
  label: Pick<GraphSceneLabel, 'fontSize' | 'lineHeight' | 'lines'>,
) {
  return label.fontSize + (label.lines.length - 1) * label.lineHeight
}

export function getGraphSceneNeighborhoodIds(
  activeId: number | null,
  neighborsById: Map<number, Set<number>>,
) {
  const ids = new Set<number>()

  if (!activeId) {
    return ids
  }

  ids.add(activeId)

  neighborsById.get(activeId)?.forEach((neighborId) => {
    ids.add(neighborId)
  })

  return ids
}

export function getGraphSceneDisplayedNodeRadius(
  radius: number,
  nodeId: number,
  activeId: number | null,
  neighborIds: Set<number>,
  compact: boolean,
) {
  if (activeId === nodeId) {
    return radius + (compact ? 1.8 : 2.4)
  }

  if (neighborIds.has(nodeId)) {
    return radius + (compact ? 0.5 : 0.8)
  }

  return radius
}

export function shouldClearGraphSceneActiveNode(
  activeId: number | null,
  leavingNodeId: number | null,
  isInteracting: boolean,
) {
  if (isInteracting || activeId === null) {
    return false
  }

  return leavingNodeId === null || activeId === leavingNodeId
}

export function shouldOpenGraphSceneNodeOnPointerUp(
  eventType: string | undefined,
  moved: boolean,
) {
  return eventType === 'pointerup' && !moved
}

export function shouldAutoResetGraphSceneViewport(
  options: ShouldAutoResetGraphSceneViewportOptions,
) {
  return (
    options.isAutoResetEnabled && !options.isNodeDragging && !options.isPanning
  )
}

export function getGraphSceneViewportFocusPoint(nodes: GraphSceneNodeLike[]) {
  if (!nodes.length) {
    return null
  }

  const totalWeight = nodes.reduce(
    (sum, node) => sum + Math.max(1, node.radius),
    0,
  )

  if (totalWeight <= 0) {
    return null
  }

  const weightedCenter = nodes.reduce(
    (sum, node) => {
      const weight = Math.max(1, node.radius)

      return {
        x: sum.x + node.x * weight,
        y: sum.y + node.y * weight,
      }
    },
    { x: 0, y: 0 },
  )

  return {
    x: Number((weightedCenter.x / totalWeight).toFixed(2)),
    y: Number((weightedCenter.y / totalWeight).toFixed(2)),
  }
}

export function buildGraphSceneLabels(
  options: BuildGraphSceneLabelsOptions,
): GraphSceneLabel[] {
  if (!options.activeId) {
    return []
  }

  const activeNode = options.nodes.find(node => node.id === options.activeId)

  if (!activeNode) {
    return []
  }

  const labels = options.nodes
    .filter(
      node =>
        node.id === options.activeId || options.neighborIds.has(node.id),
    )
    .sort((left, right) => {
      if (left.id === options.activeId) {
        return -1
      }

      if (right.id === options.activeId) {
        return 1
      }

      return right.incomingLinksCount - left.incomingLinksCount
    })
    .map((node) => {
      const isActive = node.id === options.activeId
      const radius = getGraphSceneDisplayedNodeRadius(
        node.radius,
        node.id,
        options.activeId,
        options.neighborIds,
        options.compact,
      )
      const fontSize = isActive
        ? options.compact
          ? 15
          : 20
        : options.compact
          ? 13
          : 15
      const lineHeight = fontSize + (isActive ? 3 : 2)
      const lines = wrapGraphSceneLabelText(
        node.name,
        isActive ? (options.compact ? 16 : 18) : options.compact ? 18 : 20,
      )
      const label = {
        fontSize,
        id: node.id,
        isActive,
        lineHeight,
        lines,
      }
      const textHeight = getGraphSceneLabelHeight(label)

      if (isActive) {
        return {
          ...label,
          textAnchor: 'middle' as const,
          x: node.x * options.zoom + options.pan.x,
          y:
            (node.y + radius + (options.compact ? 14 : 20)) * options.zoom
            + options.pan.y,
        }
      }

      const dx = node.x - activeNode.x
      const dy = node.y - activeNode.y
      const horizontalGap = radius + (options.compact ? 7 : 10)
      const centeredBaseline = node.y - textHeight / 2 + fontSize
      const isLeft = dx < -(options.compact ? 4 : 6)

      return {
        ...label,
        textAnchor: (isLeft ? 'end' : 'start') as const,
        x:
          (node.x + (isLeft ? -horizontalGap : horizontalGap)) * options.zoom
          + options.pan.x,
        y:
          (centeredBaseline + (dy < 0 ? -1 : dy > 0 ? 1 : 0)) * options.zoom
          + options.pan.y,
      }
    })

  return labels
}

export function getGraphSceneViewportTransform(
  options: GetGraphSceneViewportTransformOptions,
) {
  const padding: GraphSceneViewportPadding = {
    bottom: options.padding?.bottom ?? 0,
    left: options.padding?.left ?? 0,
    right: options.padding?.right ?? 0,
    top: options.padding?.top ?? 0,
  }
  const availableWidth = options.width - padding.left - padding.right
  const availableHeight = options.height - padding.top - padding.bottom
  const fittedZoom = options.compact
    ? Math.min(
        1.1,
        Math.max(
          0.72,
          Math.min(
            availableWidth / (options.bounds.width + 28),
            availableHeight / (options.bounds.height + 28),
          ),
        ),
      )
    : Math.min(
        1.28,
        Math.max(
          0.42,
          Math.min(
            availableWidth / (options.bounds.width + 80),
            availableHeight / (options.bounds.height + 80),
          ),
        ),
      )
  const zoom = Number(fittedZoom.toFixed(2))
  const graphWidth = Math.max(0, options.bounds.maxX - options.bounds.minX)
  const graphHeight = Math.max(0, options.bounds.maxY - options.bounds.minY)
  const effectiveMinX
    = options.bounds.minX - (options.bounds.width - graphWidth) / 2
  const effectiveMinY
    = options.bounds.minY - (options.bounds.height - graphHeight) / 2
  const effectiveMaxX = effectiveMinX + options.bounds.width
  const effectiveMaxY = effectiveMinY + options.bounds.height
  const focusPoint = options.focusPoint ?? {
    x: effectiveMinX + options.bounds.width / 2,
    y: effectiveMinY + options.bounds.height / 2,
  }
  const targetCenterX = padding.left + availableWidth / 2
  const targetCenterY = padding.top + availableHeight / 2
  const minPanX = padding.left - effectiveMinX * zoom
  const maxPanX = padding.left + availableWidth - effectiveMaxX * zoom
  const minPanY = padding.top - effectiveMinY * zoom
  const maxPanY = padding.top + availableHeight - effectiveMaxY * zoom
  const unclampedPanX = targetCenterX - focusPoint.x * zoom
  const unclampedPanY = targetCenterY - focusPoint.y * zoom
  const panX = Math.max(minPanX, Math.min(maxPanX, unclampedPanX))
  const panY = Math.max(minPanY, Math.min(maxPanY, unclampedPanY))

  return {
    panX: Number(panX.toFixed(2)),
    panY: Number(panY.toFixed(2)),
    zoom,
  }
}

export function getGraphSceneResetViewportTransform(
  options: GetGraphSceneResetViewportTransformOptions,
) {
  if (!options.nodes.length) {
    return {
      panX: 0,
      panY: 0,
      zoom: 1,
    }
  }

  return getGraphSceneViewportTransform({
    bounds: getNotesGraphBounds(options.nodes, options.compact ? 28 : 56),
    compact: options.compact,
    focusPoint: getGraphSceneViewportFocusPoint(options.nodes) ?? undefined,
    height: options.height,
    padding: options.padding,
    width: options.width,
  })
}
