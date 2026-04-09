import type { NotesHeatmapPalette } from '../shared/heatmapPalette'

const HEATMAP_ACTIVITY_THRESHOLDS = [1, 4, 7]

export function getNotesHeatmapTooltipLines(
  label: string,
  count: number,
  translate: (key: string, params?: { count?: number }) => string,
) {
  return [
    label,
    translate('notes.dashboard.activity.tooltipUpdates', { count }),
  ]
}

export function getNotesHeatmapColor(
  count: number,
  palette: NotesHeatmapPalette,
) {
  if (count <= 0) {
    return palette.scale[0]
  }

  if (count < HEATMAP_ACTIVITY_THRESHOLDS[1]) {
    return palette.scale[1]
  }

  if (count < HEATMAP_ACTIVITY_THRESHOLDS[2]) {
    return palette.scale[2]
  }

  if (count < 10) {
    return palette.scale[3]
  }

  return palette.scale[4]
}
