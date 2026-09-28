import { describe, expect, it } from 'vitest'
import { getNotesGraphPalette } from '../graphPalette'

describe('graphPalette', () => {
  it('returns token-based graph palettes for dark and light themes', () => {
    const darkPalette = getNotesGraphPalette(true)
    const lightPalette = getNotesGraphPalette(false)

    expect(darkPalette.background).toContain('var(--canvas)')
    expect(darkPalette.edgeActive).toContain('var(--primary)')
    expect(darkPalette.nodeLabelActive).toBe('var(--foreground)')
    expect(darkPalette.nodeFillNeighbor).toContain('var(--primary)')
    expect(darkPalette.nodeStrokeNeighbor).toContain('var(--primary)')
    expect(lightPalette.background).toContain('var(--canvas)')
    expect(lightPalette.nodeFillNeighbor).toContain('var(--primary)')
    expect(lightPalette.nodeStrokeNeighbor).toContain('var(--primary)')
    expect(lightPalette.nodeLabelMuted).not.toBe(darkPalette.nodeLabelMuted)
    expect(lightPalette.edgeBase).not.toBe(darkPalette.edgeBase)
  })
})
