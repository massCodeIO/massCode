import { describe, expect, it } from 'vitest'
import {
  buildGraphSceneLabels,
  getGraphSceneBaseNodeFill,
  getGraphSceneDisplayedNodeRadius,
  getGraphSceneEdgeEndpoints,
  getGraphSceneNeighborhoodIds,
  getGraphSceneResetViewportTransform,
  getGraphSceneSeedTicks,
  getGraphSceneViewportFocusPoint,
  getGraphSceneViewportTransform,
  getGraphSceneZoom,
  shouldAutoResetGraphSceneViewport,
  shouldClearGraphSceneActiveNode,
  shouldOpenGraphSceneNodeOnPointerUp,
} from '../scene'

describe('notesGraphScene', () => {
  it('fits every node of a large compact graph without a minimum zoom', () => {
    const nodes = [
      {
        id: 1,
        name: 'Left',
        incomingLinksCount: 0,
        x: -2000,
        y: -1500,
        radius: 4,
      },
      {
        id: 2,
        name: 'Right',
        incomingLinksCount: 0,
        x: 2000,
        y: 1500,
        radius: 4,
      },
    ]
    const viewport = getGraphSceneResetViewportTransform({
      compact: true,
      nodes,
      width: 320,
      height: 256,
    })

    for (const node of nodes) {
      expect(
        (node.x - node.radius) * viewport.zoom + viewport.panX,
      ).toBeGreaterThanOrEqual(0)
      expect(
        (node.x + node.radius) * viewport.zoom + viewport.panX,
      ).toBeLessThanOrEqual(320)
      expect(
        (node.y - node.radius) * viewport.zoom + viewport.panY,
      ).toBeGreaterThanOrEqual(0)
      expect(
        (node.y + node.radius) * viewport.zoom + viewport.panY,
      ).toBeLessThanOrEqual(256)
    }
  })

  it('scales seed ticks down as the graph grows', () => {
    expect(getGraphSceneSeedTicks(0)).toBe(0)
    expect(getGraphSceneSeedTicks(20)).toBe(20)
    expect(getGraphSceneSeedTicks(100)).toBe(20)
    expect(getGraphSceneSeedTicks(400)).toBe(5)
    expect(getGraphSceneSeedTicks(1000)).toBe(2)
    expect(getGraphSceneSeedTicks(5000)).toBe(0)
  })

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

  it('brightens base node fill as connectivity grows', () => {
    expect(getGraphSceneBaseNodeFill(0, 4, true)).toBe(
      'color-mix(in oklab, var(--foreground) 34%, var(--background))',
    )
    expect(getGraphSceneBaseNodeFill(2, 4, true)).toBe(
      'color-mix(in oklab, var(--foreground) 48%, var(--background))',
    )
    expect(getGraphSceneBaseNodeFill(4, 4, false)).toBe(
      'color-mix(in oklab, var(--foreground) 48%, var(--background))',
    )
  })

  it('clips graph edges to the edge of node circles', () => {
    expect(
      getGraphSceneEdgeEndpoints(
        {
          radius: 10,
          x: 100,
          y: 100,
        },
        {
          radius: 6,
          x: 140,
          y: 100,
        },
      ),
    ).toEqual({
      x1: 110,
      x2: 134,
      y1: 100,
      y2: 100,
    })
  })

  it('clears hovered node when pointer leaves it without interaction', () => {
    expect(shouldClearGraphSceneActiveNode(7, 7, false)).toBe(true)
    expect(shouldClearGraphSceneActiveNode(7, 3, false)).toBe(false)
    expect(shouldClearGraphSceneActiveNode(7, null, false)).toBe(true)
    expect(shouldClearGraphSceneActiveNode(7, 7, true)).toBe(false)
  })

  it('opens a node on pointerup only when it was not dragged', () => {
    expect(shouldOpenGraphSceneNodeOnPointerUp('pointerup', false)).toBe(true)
    expect(shouldOpenGraphSceneNodeOnPointerUp('pointerup', true)).toBe(false)
    expect(shouldOpenGraphSceneNodeOnPointerUp('pointerleave', false)).toBe(
      false,
    )
    expect(shouldOpenGraphSceneNodeOnPointerUp(undefined, false)).toBe(false)
  })

  it('auto-resets viewport only while graph is not being manipulated', () => {
    expect(
      shouldAutoResetGraphSceneViewport({
        isAutoResetEnabled: true,
        isNodeDragging: false,
        isPanning: false,
      }),
    ).toBe(true)

    expect(
      shouldAutoResetGraphSceneViewport({
        isAutoResetEnabled: false,
        isNodeDragging: false,
        isPanning: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoResetGraphSceneViewport({
        isAutoResetEnabled: true,
        isNodeDragging: true,
        isPanning: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoResetGraphSceneViewport({
        isAutoResetEnabled: true,
        isNodeDragging: false,
        isPanning: true,
      }),
    ).toBe(false)
  })

  it('derives viewport focus from the weighted center of visible nodes', () => {
    expect(
      getGraphSceneViewportFocusPoint([
        {
          id: 1,
          incomingLinksCount: 1,
          name: 'Small',
          radius: 4,
          x: 100,
          y: 80,
        },
        {
          id: 2,
          incomingLinksCount: 3,
          name: 'Large',
          radius: 8,
          x: 220,
          y: 140,
        },
      ]),
    ).toEqual({
      x: 180,
      y: 120,
    })
  })

  it('suppresses overlapping neighbors and keeps only the active compact label', () => {
    const labels = buildGraphSceneLabels({
      width: 1000,
      height: 720,
      measureText: (text, fontSize) => text.length * fontSize * 0.6,
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

    expect(labels.map(label => label.id)).toEqual([1, 3])

    const crowdedLabels = buildGraphSceneLabels({
      width: 1000,
      height: 720,
      measureText: (text, fontSize) => text.length * fontSize * 0.6,
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

    expect(crowdedLabels.map(label => label.id)).toEqual([2])
  })

  it('wraps long labels by words without truncating text', () => {
    const labels = buildGraphSceneLabels({
      width: 1000,
      height: 720,
      measureText: (text, fontSize) => text.length * fontSize * 0.6,
      activeId: 1,
      compact: false,
      neighborIds: new Set(),
      nodes: [
        {
          id: 1,
          incomingLinksCount: 5,
          name: 'Very Long Active Node Label Example',
          radius: 4,
          x: 100,
          y: 100,
        },
      ],
      pan: { x: 0, y: 0 },
      zoom: 1,
    })

    expect(labels[0]?.lines.join(' ')).toBe(
      'Very Long Active Node Label Example',
    )
    expect(labels[0]?.lines.length).toBeGreaterThan(1)
    expect(labels[0]?.lines.some(line => line.includes('…'))).toBe(false)
    expect(labels[0]?.fontSize).toBeGreaterThan(18)
  })

  it('places secondary labels beside their own nodes with consistent alignment', () => {
    const labels = buildGraphSceneLabels({
      width: 1000,
      height: 720,
      measureText: (text, fontSize) => text.length * fontSize * 0.6,
      activeId: 1,
      compact: false,
      neighborIds: new Set([2, 3, 4, 5]),
      nodes: [
        {
          id: 1,
          incomingLinksCount: 5,
          name: 'Center',
          radius: 4,
          x: 100,
          y: 100,
        },
        {
          id: 2,
          incomingLinksCount: 2,
          name: 'Right Node',
          radius: 4,
          x: 145,
          y: 100,
        },
        {
          id: 3,
          incomingLinksCount: 2,
          name: 'L',
          radius: 4,
          x: 55,
          y: 100,
        },
        {
          id: 4,
          incomingLinksCount: 2,
          name: 'Top Node',
          radius: 4,
          x: 100,
          y: 55,
        },
        {
          id: 5,
          incomingLinksCount: 2,
          name: 'Bottom Node',
          radius: 4,
          x: 100,
          y: 200,
        },
      ],
      pan: { x: 0, y: 0 },
      zoom: 1,
    })

    const rightLabel = labels.find(label => label.id === 2)
    const leftLabel = labels.find(label => label.id === 3)
    const topLabel = labels.find(label => label.id === 4)
    const bottomLabel = labels.find(label => label.id === 5)

    expect(rightLabel?.textAnchor).toBe('start')
    expect(rightLabel?.x).toBeGreaterThan(145)
    expect(leftLabel?.textAnchor).toBe('end')
    expect(leftLabel?.x).toBeLessThan(55)
    expect(topLabel?.textAnchor).toBe('start')
    expect(topLabel?.x).toBeGreaterThan(100)
    expect(bottomLabel?.textAnchor).toBe('start')
    expect(bottomLabel?.x).toBeGreaterThan(100)
  })

  it('keeps a long Cyrillic active label inside the viewport at its bottom edge', () => {
    const name = 'ШирокоеНазваниеБезПробелов И ещё одна заметка'
    const measureText = (text: string) =>
      Array.from(text).reduce(
        (width, char) => width + (char === 'Ш' ? 20 : 9),
        0,
      )
    const labels = buildGraphSceneLabels({
      width: 180,
      height: 160,
      measureText,
      activeId: 1,
      compact: true,
      neighborIds: new Set(),
      nodes: [
        { id: 1, name, incomingLinksCount: 0, radius: 4, x: 178, y: 158 },
      ],
      pan: { x: 0, y: 0 },
      zoom: 1,
    })
    const label = labels[0]!
    const width = Math.max(...label.lines.map(measureText))
    expect(label.lines.join('').replace(/ /g, '')).toBe(name.replace(/ /g, ''))
    expect(label.x - width / 2).toBeGreaterThanOrEqual(8)
    expect(label.x + width / 2).toBeLessThanOrEqual(172)
    expect(label.y - label.fontSize).toBeGreaterThanOrEqual(8)
    expect(
      label.y - label.fontSize + label.lines.length * label.lineHeight,
    ).toBeLessThanOrEqual(152)
  })

  it('reveals more neighboring labels when zoom creates enough space', () => {
    const options = {
      width: 1000,
      height: 720,
      measureText: (text: string, fontSize: number) =>
        text.length * fontSize * 0.6,
      activeId: 1,
      compact: false,
      neighborIds: new Set([2, 3]),
      nodes: [
        {
          id: 1,
          name: 'Center',
          incomingLinksCount: 10,
          radius: 4,
          x: 100,
          y: 100,
        },
        {
          id: 2,
          name: 'Neighbor A',
          incomingLinksCount: 2,
          radius: 4,
          x: 140,
          y: 100,
        },
        {
          id: 3,
          name: 'Neighbor B',
          incomingLinksCount: 2,
          radius: 4,
          x: 140,
          y: 125,
        },
      ],
      pan: { x: 100, y: 100 },
    }
    const distant = buildGraphSceneLabels({ ...options, zoom: 0.2 })
    const close = buildGraphSceneLabels({ ...options, zoom: 2 })
    expect(distant[0]?.id).toBe(1)
    expect(close.map(label => label.id)).toEqual([1, 2, 3])
    expect(close.length).toBeGreaterThan(distant.length)
    expect(
      buildGraphSceneLabels({
        ...options,
        nodes: [...options.nodes].reverse(),
        zoom: 0.2,
      }),
    ).toEqual(distant)
  })

  it('culls a dense neighborhood without overlaps or clipped secondary labels', () => {
    const nodes = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Заметка ${index + 1}`,
      incomingLinksCount: 60 - index,
      radius: 4,
      x: 170 + Math.cos(index) * 100,
      y: 120 + Math.sin(index) * 100,
    }))
    const measureText = (text: string, fontSize: number) =>
      text.length * fontSize * 0.7
    const labels = buildGraphSceneLabels({
      width: 360,
      height: 260,
      measureText,
      activeId: 1,
      compact: false,
      neighborIds: new Set(nodes.slice(1).map(node => node.id)),
      nodes,
      pan: { x: 0, y: 0 },
      zoom: 1,
    })
    expect(labels[0]?.id).toBe(1)
    expect(labels.length).toBeLessThan(nodes.length)
    const bounds = labels.map((label) => {
      const width = Math.max(
        ...label.lines.map(text => measureText(text, label.fontSize)),
      )
      const left
        = label.x
          - (label.textAnchor === 'middle'
            ? width / 2
            : label.textAnchor === 'end'
              ? width
              : 0)
      return {
        left,
        right: left + width,
        top: label.y - label.fontSize,
        bottom:
          label.y - label.fontSize + label.lines.length * label.lineHeight,
      }
    })
    bounds.forEach((box, index) => {
      expect(box.left).toBeGreaterThanOrEqual(8)
      expect(box.right).toBeLessThanOrEqual(352)
      expect(box.top).toBeGreaterThanOrEqual(8)
      expect(box.bottom).toBeLessThanOrEqual(252)
      for (const other of bounds.slice(index + 1)) {
        expect(
          box.left < other.right
          && box.right > other.left
          && box.top < other.bottom
          && box.bottom > other.top,
        ).toBe(false)
      }
    })
  })

  it('never reverses zoom-out below the former compact minimum', () => {
    for (const compact of [true, false]) {
      const fit = 0.0043
      const out = getGraphSceneZoom(fit * 0.9, fit, compact)
      expect(out).toBeGreaterThan(0)
      expect(out).toBeLessThan(fit)
      expect(getGraphSceneZoom(out * 1.1, fit, compact)).toBeGreaterThan(out)
      expect(getGraphSceneZoom(0, fit, compact)).toBe(fit * 0.5)
    }
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

  it('derives centered reset transform from sparse graph nodes', () => {
    expect(
      getGraphSceneResetViewportTransform({
        compact: true,
        height: 240,
        nodes: [
          {
            id: 1,
            incomingLinksCount: 2,
            name: 'Left',
            radius: 4,
            x: 100,
            y: 84,
          },
          {
            id: 2,
            incomingLinksCount: 1,
            name: 'Right',
            radius: 4,
            x: 120,
            y: 104,
          },
        ],
        width: 560,
      }),
    ).toEqual({
      panX: 159,
      panY: 16.6,
      zoom: 1.1,
    })
  })

  it('applies viewport padding when deriving reset transform from graph nodes', () => {
    expect(
      getGraphSceneResetViewportTransform({
        compact: true,
        height: 240,
        nodes: [
          {
            id: 1,
            incomingLinksCount: 2,
            name: 'Left',
            radius: 4,
            x: 64,
            y: 44,
          },
          {
            id: 2,
            incomingLinksCount: 3,
            name: 'Right',
            radius: 4,
            x: 156,
            y: 116,
          },
        ],
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
})
