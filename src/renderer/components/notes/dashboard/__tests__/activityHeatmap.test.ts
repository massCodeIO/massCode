import { describe, expect, it } from 'vitest'
import { getNotesHeatmapPalette } from '../../shared/heatmapPalette'
import {
  getNotesHeatmapColor,
  getNotesHeatmapTooltipLines,
} from '../activityHeatmap'

describe('notesDashboardActivityHeatmap', () => {
  it('builds tooltip lines for a day with updates', () => {
    const translate = (key: string, params?: { count?: number }) => {
      if (key === 'notes.dashboard.activity.tooltipUpdates') {
        return `${params?.count} note updates`
      }

      return key
    }

    expect(getNotesHeatmapTooltipLines('Tue, Apr 7', 3, translate)).toEqual([
      'Tue, Apr 7',
      '3 note updates',
    ])
  })

  it('uses fixed activity thresholds instead of stretching to local max', () => {
    const palette = getNotesHeatmapPalette(true)

    expect(getNotesHeatmapColor(0, palette)).toBe(palette.scale[0])
    expect(getNotesHeatmapColor(1, palette)).toBe(palette.scale[1])
    expect(getNotesHeatmapColor(2, palette)).toBe(palette.scale[1])
    expect(getNotesHeatmapColor(4, palette)).toBe(palette.scale[2])
    expect(getNotesHeatmapColor(7, palette)).toBe(palette.scale[3])
    expect(getNotesHeatmapColor(10, palette)).toBe(palette.scale[4])
  })
})
