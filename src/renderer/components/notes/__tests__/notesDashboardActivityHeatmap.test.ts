import { describe, expect, it } from 'vitest'
import { getNotesHeatmapTooltipLines } from '../notesDashboardActivityHeatmap'

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
})
