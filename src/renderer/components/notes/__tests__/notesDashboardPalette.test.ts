import { describe, expect, it } from 'vitest'
import {
  getNotesGraphPalette,
  getNotesHeatmapPalette,
} from '../notesDashboardPalette'

describe('notesDashboardPalette', () => {
  it('returns token-based graph palettes for dark and light themes', () => {
    const darkPalette = getNotesGraphPalette(true)
    const lightPalette = getNotesGraphPalette(false)

    expect(darkPalette.background).toContain('var(--background)')
    expect(darkPalette.edgeActive).toContain('var(--primary)')
    expect(darkPalette.nodeLabelActive).toBe('var(--foreground)')
    expect(lightPalette.background).toContain('var(--background)')
    expect(lightPalette.nodeLabelMuted).not.toBe(darkPalette.nodeLabelMuted)
    expect(lightPalette.edgeBase).not.toBe(darkPalette.edgeBase)
  })

  it('returns github-style heatmap palettes for dark and light themes', () => {
    const darkPalette = getNotesHeatmapPalette(true)
    const lightPalette = getNotesHeatmapPalette(false)

    expect(darkPalette.scale).toEqual([
      'var(--background)',
      '#0e4429',
      '#006d32',
      '#26a641',
      '#39d353',
    ])
    expect(lightPalette.scale).toEqual([
      'var(--background)',
      '#9be9a8',
      '#40c463',
      '#30a14e',
      '#216e39',
    ])
  })
})
