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

export const NOTES_HEATMAP_WEEKS = 53
export const NOTES_HEATMAP_DAYS = 7

export function getNotesHeatmapCells(days: object, now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  const length = NOTES_HEATMAP_WEEKS * NOTES_HEATMAP_DAYS
  const start = today.getTime() - (length - 1) * dayMs
  return Array.from({ length }, (_, index) => {
    const date = new Date(start + index * dayMs)
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
    return { date, key, count: (days as Record<string, number>)[key] ?? 0 }
  })
}
