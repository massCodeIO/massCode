import { describe, expect, it } from 'vitest'
import {
  buildNotesGraphLayout,
  getNotesGraphConnectedCounts,
  getNotesGraphNodeRadius,
} from '../layout'

describe('notesGraphLayout', () => {
  it('counts unique neighbors for each node regardless of link direction', () => {
    expect(
      getNotesGraphConnectedCounts(
        [
          { id: 1, incomingLinksCount: 1, name: 'Center' },
          { id: 2, incomingLinksCount: 1, name: 'Left' },
          { id: 3, incomingLinksCount: 1, name: 'Right' },
        ],
        [
          { source: 1, target: 2 },
          { source: 1, target: 3 },
          { source: 2, target: 1 },
        ],
      ),
    ).toEqual(
      new Map([
        [1, 2],
        [2, 1],
        [3, 1],
      ]),
    )
  })

  it('sizes nodes by connected note count instead of incoming links only', () => {
    const nodeRadiusById = new Map(
      buildNotesGraphLayout(
        [
          { id: 1, incomingLinksCount: 0, name: 'Hub' },
          { id: 2, incomingLinksCount: 2, name: 'Leaf A' },
          { id: 3, incomingLinksCount: 2, name: 'Leaf B' },
          { id: 4, incomingLinksCount: 0, name: 'Leaf C' },
          { id: 5, incomingLinksCount: 0, name: 'Leaf D' },
        ],
        [
          { source: 1, target: 2 },
          { source: 1, target: 3 },
          { source: 1, target: 4 },
          { source: 1, target: 5 },
          { source: 2, target: 1 },
          { source: 3, target: 1 },
        ],
      ).nodes.map(node => [node.id, node.radius]),
    )

    expect(nodeRadiusById.get(1)).toBeGreaterThan(nodeRadiusById.get(2) ?? 0)
    expect(nodeRadiusById.get(1)).toBe(getNotesGraphNodeRadius(4, false))
    expect(nodeRadiusById.get(2)).toBe(getNotesGraphNodeRadius(1, false))
  })
})
