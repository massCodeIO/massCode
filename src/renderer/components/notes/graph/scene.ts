import { getNotesGraphBounds } from './layout'

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
  width: number
  height: number
  measureText: (text: string, fontSize: number, isActive: boolean) => number
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

function wrapGraphSceneLabelText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
) {
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) {
      lines.push(line)
      line = ''
    }
    // Long filenames and unbroken titles also need to fit the viewport.
    for (const character of word) {
      if (line && measure(line + character) > maxWidth) {
        lines.push(line)
        line = ''
      }
      line += character
    }
  }
  if (line)
    lines.push(line)
  return lines
}

export function getGraphSceneSeedTicks(nodeCount: number) {
  if (nodeCount <= 0) {
    return 0
  }

  return Math.min(20, Math.floor(2000 / nodeCount))
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

export function getGraphSceneBaseNodeFill(
  connectedNotesCount: number,
  maxConnectedNotesCount: number,
  isDark: boolean,
) {
  const normalizedMax = Math.max(1, maxConnectedNotesCount)
  const ratio = Math.max(0, Math.min(connectedNotesCount / normalizedMax, 1))
  const minWeight = isDark ? 34 : 18
  const maxWeight = isDark ? 62 : 48
  const weight = Number(
    (minWeight + (maxWeight - minWeight) * ratio).toFixed(1),
  )

  return `color-mix(in oklab, var(--foreground) ${weight}%, var(--background))`
}

export function getGraphSceneEdgeEndpoints(
  source: Pick<GraphSceneNodeLike, 'radius' | 'x' | 'y'>,
  target: Pick<GraphSceneNodeLike, 'radius' | 'x' | 'y'>,
) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.hypot(dx, dy)

  if (!distance) {
    return {
      x1: source.x,
      x2: target.x,
      y1: source.y,
      y2: target.y,
    }
  }

  const unitX = dx / distance
  const unitY = dy / distance

  return {
    x1: Number((source.x + unitX * source.radius).toFixed(2)),
    x2: Number((target.x - unitX * target.radius).toFixed(2)),
    y1: Number((source.y + unitY * source.radius).toFixed(2)),
    y2: Number((target.y - unitY * target.radius).toFixed(2)),
  }
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

  const candidates = options.nodes
    .filter(
      node =>
        node.id === options.activeId
        || (!options.compact && options.neighborIds.has(node.id)),
    )
    .sort((left, right) => {
      if (left.id === options.activeId)
        return -1
      if (right.id === options.activeId)
        return 1
      return (
        right.incomingLinksCount - left.incomingLinksCount || left.id - right.id
      )
    })
  const labels: GraphSceneLabel[] = []
  const occupied: {
    left: number
    top: number
    right: number
    bottom: number
  }[] = []
  const margin = 8

  for (const node of candidates) {
    const isActive = node.id === options.activeId
    const fontSize = isActive ? (options.compact ? 15 : 20) : 15
    const lineHeight = fontSize + (isActive ? 3 : 2)
    const measure = (text: string) =>
      options.measureText(text, fontSize, isActive)
    const maxWidth = Math.max(
      1,
      Math.min(isActive ? 240 : 180, options.width - margin * 2),
    )
    const lines = wrapGraphSceneLabelText(node.name, maxWidth, measure)
    if (!lines.length)
      continue
    const maxLines = Math.max(
      1,
      Math.floor((options.height - margin * 2) / lineHeight),
    )
    if (lines.length > maxLines) {
      lines.length = maxLines
      let last = lines[maxLines - 1]!
      while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
      lines[maxLines - 1] = `${last}…`
    }
    const textWidth = Math.max(...lines.map(measure))
    // Include descenders, not just the distance between SVG baselines.
    const textHeight = lines.length * lineHeight
    const radius
      = getGraphSceneDisplayedNodeRadius(
        node.radius,
        node.id,
        options.activeId,
        options.neighborIds,
        options.compact,
      ) * options.zoom
    const nodeX = node.x * options.zoom + options.pan.x
    const nodeY = node.y * options.zoom + options.pan.y
    const isLeft = node.x < activeNode.x
    const textAnchor = isActive ? 'middle' : isLeft ? 'end' : 'start'
    let left = isActive
      ? nodeX - textWidth / 2
      : isLeft
        ? nodeX - radius - 10 - textWidth
        : nodeX + radius + 10
    let top = isActive ? nodeY + radius + 8 : nodeY - textHeight / 2
    if (isActive) {
      if (top + textHeight > options.height - margin)
        top = nodeY - radius - 8 - textHeight
      left = Math.max(
        margin,
        Math.min(options.width - margin - textWidth, left),
      )
      top = Math.max(
        margin,
        Math.min(options.height - margin - textHeight, top),
      )
    }
    const bounds = {
      left,
      top,
      right: left + textWidth,
      bottom: top + textHeight,
    }
    if (
      !isActive
      && (bounds.left < margin
        || bounds.top < margin
        || bounds.right > options.width - margin
        || bounds.bottom > options.height - margin
        || occupied.some(
          other =>
            bounds.left < other.right + 4
            && bounds.right + 4 > other.left
            && bounds.top < other.bottom + 4
            && bounds.bottom + 4 > other.top,
        ))
    ) {
      continue
    }
    occupied.push(bounds)
    labels.push({
      id: node.id,
      isActive,
      fontSize,
      lineHeight,
      lines,
      textAnchor,
      x:
        left
        + (textAnchor === 'middle'
          ? textWidth / 2
          : textAnchor === 'end'
            ? textWidth
            : 0),
      y: top + fontSize,
    })
  }
  return labels
}

export function getGraphSceneZoom(
  nextZoom: number,
  fittedZoom: number,
  compact: boolean,
) {
  const minimum = Math.min(compact ? 0.58 : 0.35, fittedZoom * 0.5)
  return Math.min(compact ? 2.4 : 2.8, Math.max(minimum, nextZoom))
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
        availableWidth / (options.bounds.width + 28),
        availableHeight / (options.bounds.height + 28),
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
  const zoom = options.compact ? fittedZoom : Number(fittedZoom.toFixed(2))
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
