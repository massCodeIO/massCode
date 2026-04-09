export interface NotesGraphPalette {
  background: string
  edgeActive: string
  edgeBase: string
  edgeDimmed: string
  footerText: string
  nodeHaloActive: string
  nodeHaloBase: string
  nodeHaloDimmed: string
  nodeHaloNeighbor: string
  nodeFillActive: string
  nodeFillDimmed: string
  nodeFillNeighbor: string
  nodeLabelActive: string
  nodeLabelMuted: string
  nodeStrokeActive: string
  nodeStrokeBase: string
  nodeStrokeDimmed: string
  nodeStrokeNeighbor: string
  overlayText: string
}

export function getNotesGraphPalette(isDark: boolean): NotesGraphPalette {
  if (isDark) {
    return {
      background: 'var(--canvas)',
      edgeActive: 'oklch(from var(--primary) l c h / 0.9)',
      edgeBase: 'oklch(from var(--foreground) l c h / 0.14)',
      edgeDimmed: 'oklch(from var(--muted-foreground) l c h / 0.08)',
      footerText: 'oklch(from var(--muted-foreground) l c h / 0.8)',
      nodeHaloActive: 'oklch(from var(--primary) l c h / 0.22)',
      nodeHaloBase: 'oklch(from var(--foreground) l c h / 0.02)',
      nodeHaloDimmed: 'oklch(from var(--foreground) l c h / 0.01)',
      nodeHaloNeighbor: 'oklch(from var(--primary) l c h / 0.1)',
      nodeFillActive: 'var(--primary)',
      nodeFillDimmed: 'oklch(from var(--muted-foreground) l c h / 0.34)',
      nodeFillNeighbor: 'oklch(from var(--primary) l c h / 0.5)',
      nodeLabelActive: 'var(--foreground)',
      nodeLabelMuted: 'oklch(from var(--muted-foreground) l c h / 0.8)',
      nodeStrokeActive: 'oklch(from var(--primary) l c h / 0.95)',
      nodeStrokeBase: 'oklch(from var(--foreground) l c h / 0.08)',
      nodeStrokeDimmed: 'oklch(from var(--foreground) l c h / 0.03)',
      nodeStrokeNeighbor: 'oklch(from var(--primary) l c h / 0.3)',
      overlayText: 'oklch(from var(--muted-foreground) l c h / 0.82)',
    }
  }

  return {
    background: 'var(--canvas)',
    edgeActive: 'oklch(from var(--primary) l c h / 0.82)',
    edgeBase: 'oklch(from var(--foreground) l c h / 0.16)',
    edgeDimmed: 'oklch(from var(--muted-foreground) l c h / 0.08)',
    footerText: 'oklch(from var(--muted-foreground) l c h / 0.9)',
    nodeHaloActive: 'oklch(from var(--primary) l c h / 0.16)',
    nodeHaloBase: 'oklch(from var(--foreground) l c h / 0.03)',
    nodeHaloDimmed: 'oklch(from var(--foreground) l c h / 0.02)',
    nodeHaloNeighbor: 'oklch(from var(--primary) l c h / 0.08)',
    nodeFillActive: 'var(--primary)',
    nodeFillDimmed: 'oklch(from var(--muted-foreground) l c h / 0.3)',
    nodeFillNeighbor: 'oklch(from var(--primary) l c h / 0.3)',
    nodeLabelActive: 'var(--foreground)',
    nodeLabelMuted: 'oklch(from var(--muted-foreground) l c h / 0.9)',
    nodeStrokeActive: 'oklch(from var(--primary) l c h / 0.9)',
    nodeStrokeBase: 'oklch(from var(--foreground) l c h / 0.1)',
    nodeStrokeDimmed: 'oklch(from var(--foreground) l c h / 0.04)',
    nodeStrokeNeighbor: 'oklch(from var(--primary) l c h / 0.2)',
    overlayText: 'oklch(from var(--muted-foreground) l c h / 0.92)',
  }
}
