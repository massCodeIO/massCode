import { describe, expect, it, vi } from 'vitest'
import { loadNotesGraphIfNeeded } from '../loader'

describe('loadNotesGraphIfNeeded', () => {
  it('loads graph data when it is missing', () => {
    const getNotesGraph = vi.fn()

    loadNotesGraphIfNeeded(null, getNotesGraph)

    expect(getNotesGraph).toHaveBeenCalledOnce()
  })

  it('does not reload graph data when it already exists', () => {
    const getNotesGraph = vi.fn()

    loadNotesGraphIfNeeded(
      {
        edges: [],
        nodes: [{ id: 1, incomingLinksCount: 0, name: 'Note' }],
      },
      getNotesGraph,
    )

    expect(getNotesGraph).not.toHaveBeenCalled()
  })
})
