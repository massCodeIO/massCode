export interface GraphSceneNodeLike {
  id: number
  incomingLinksCount: number
  name: string
  radius: number
  x: number
  y: number
}

export interface GraphSceneLabel {
  id: number
  isActive: boolean
  text: string
  textAnchor: 'middle' | 'start'
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

export function buildGraphSceneLabels(
  options: BuildGraphSceneLabelsOptions,
): GraphSceneLabel[] {
  if (!options.activeId) {
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
      const truncateAt = options.compact ? 20 : 26
      const text
        = node.name.length > truncateAt
          ? `${node.name.slice(0, truncateAt)}…`
          : node.name
      const textAnchor: GraphSceneLabel['textAnchor'] = isActive
        ? 'middle'
        : 'start'

      return {
        id: node.id,
        isActive,
        text,
        textAnchor,
        x: isActive
          ? node.x * options.zoom + options.pan.x
          : (node.x + radius + (options.compact ? 6 : 8)) * options.zoom
            + options.pan.x,
        y: isActive
          ? (node.y + radius + (options.compact ? 13 : 18)) * options.zoom
          + options.pan.y
          : (node.y + 3) * options.zoom + options.pan.y,
      }
    })

  const occupiedBoxes: Array<{
    bottom: number
    left: number
    right: number
    top: number
  }> = []

  return labels.filter((label) => {
    const fontSize = label.isActive
      ? options.compact
        ? 12
        : 15
      : options.compact
        ? 10
        : 11
    const width
      = label.text.length
        * (label.isActive
          ? options.compact
            ? 6.2
            : 7.4
          : options.compact
            ? 5.6
            : 6.1)
    const left = label.textAnchor === 'middle' ? label.x - width / 2 : label.x
    const right
      = label.textAnchor === 'middle' ? label.x + width / 2 : label.x + width
    const top = label.y - fontSize
    const bottom = label.y + 4
    const overlaps = occupiedBoxes.some(
      box =>
        left < box.right
        && right > box.left
        && top < box.bottom
        && bottom > box.top,
    )

    if (overlaps) {
      return false
    }

    occupiedBoxes.push({
      left: left - (options.compact ? 3 : 4),
      right: right + (options.compact ? 3 : 4),
      top: top - 2,
      bottom: bottom + 2,
    })

    return true
  })
}
