interface NotesGraphNodeLike {
  id: number
  incomingLinksCount: number
  name: string
}

interface NotesGraphDataLike {
  edges: Array<{
    source: number
    target: number
  }>
  nodes: NotesGraphNodeLike[]
}

export function loadNotesGraphIfNeeded(
  graphData: NotesGraphDataLike | null,
  getNotesGraph: () => unknown,
) {
  if (graphData) {
    return
  }

  getNotesGraph()
}
