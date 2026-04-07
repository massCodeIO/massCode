import { describe, expect, it } from 'vitest'
import {
  buildGraphSceneLabels,
  getGraphSceneDisplayedNodeRadius,
  getGraphSceneNeighborhoodIds,
  getGraphSceneViewportTransform,
} from '../notesGraphScene'

describe('notesGraphScene', () => {
  it('builds active neighborhood from the active node and its neighbors', () => {
    const neighborsById = new Map<number, Set<number>>([
      [1, new Set([2, 3])],
      [2, new Set([1])],
      [3, new Set([1])],
      [4, new Set()],
    ])

    expect(getGraphSceneNeighborhoodIds(1, neighborsById)).toEqual(
      new Set([1, 2, 3]),
    )
    expect(getGraphSceneNeighborhoodIds(null, neighborsById)).toEqual(
      new Set(),
    )
  })

  it('increases active and neighbor node radii', () => {
    const neighborIds = new Set([2, 3])

    expect(getGraphSceneDisplayedNodeRadius(4, 1, 1, neighborIds, false)).toBe(
      6.4,
    )
    expect(getGraphSceneDisplayedNodeRadius(4, 2, 1, neighborIds, false)).toBe(
      4.8,
    )
    expect(getGraphSceneDisplayedNodeRadius(4, 4, 1, neighborIds, false)).toBe(
      4,
    )
    expect(getGraphSceneDisplayedNodeRadius(4, 1, 1, neighborIds, true)).toBe(
      5.8,
    )
  })

  it('keeps the active label and drops overlapping secondary labels', () => {
    const labels = buildGraphSceneLabels({
      activeId: 1,
      compact: false,
      neighborIds: new Set([2, 3]),
      nodes: [
        {
          id: 1,
          incomingLinksCount: 5,
          name: 'Active Node',
          radius: 4,
          x: 100,
          y: 100,
        },
        {
          id: 2,
          incomingLinksCount: 2,
          name: 'Very Long Neighbor Label',
          radius: 4,
          x: 115,
          y: 100,
        },
        {
          id: 3,
          incomingLinksCount: 1,
          name: 'Far',
          radius: 4,
          x: 200,
          y: 120,
        },
      ],
      pan: { x: 0, y: 0 },
      zoom: 1,
    })

    expect(labels.map(label => label.id)).toEqual([1, 2, 3])

    const crowdedLabels = buildGraphSceneLabels({
      activeId: 2,
      compact: true,
      neighborIds: new Set([1, 3]),
      nodes: [
        {
          id: 1,
          incomingLinksCount: 2,
          name: 'Crowded One',
          radius: 3,
          x: 100,
          y: 100,
        },
        {
          id: 2,
          incomingLinksCount: 4,
          name: 'Center',
          radius: 3,
          x: 102,
          y: 100,
        },
        {
          id: 3,
          incomingLinksCount: 1,
          name: 'Crowded Two',
          radius: 3,
          x: 104,
          y: 100,
        },
      ],
      pan: { x: 0, y: 0 },
      zoom: 1,
    })

    expect(crowdedLabels[0]?.id).toBe(2)
    expect(crowdedLabels).toHaveLength(1)
  })

  it('fits graph bounds into a padded viewport', () => {
    expect(
      getGraphSceneViewportTransform({
        bounds: {
          height: 80,
          maxX: 160,
          maxY: 120,
          minX: 60,
          minY: 40,
          width: 100,
        },
        compact: true,
        height: 240,
        padding: {
          bottom: 12,
          left: 16,
          right: 96,
          top: 16,
        },
        width: 560,
      }),
    ).toEqual({
      panX: 119,
      panY: 34,
      zoom: 1.1,
    })
  })

  it('centers graphs with minimum padded bounds', () => {
    expect(
      getGraphSceneViewportTransform({
        bounds: {
          height: 160,
          maxX: 124,
          maxY: 108,
          minX: 96,
          minY: 80,
          width: 240,
        },
        compact: true,
        height: 240,
        width: 560,
      }),
    ).toEqual({
      panX: 159,
      panY: 16.6,
      zoom: 1.1,
    })
  })

  it('can center viewport around a visual focus point instead of raw bounds center', () => {
    expect(
      getGraphSceneViewportTransform({
        bounds: {
          height: 160,
          maxX: 220,
          maxY: 170,
          minX: 20,
          minY: 10,
          width: 240,
        },
        compact: true,
        focusPoint: {
          x: 160,
          y: 90,
        },
        height: 240,
        width: 560,
      }),
    ).toEqual({
      panX: 104,
      panY: 21,
      zoom: 1.1,
    })
  })
})
