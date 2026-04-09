import { describe, expect, it } from 'vitest'
import { getNotesHeatmapPalette } from '../heatmapPalette'

describe('heatmapPalette', () => {
  it('returns green heatmap palettes for dark and light themes', () => {
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
