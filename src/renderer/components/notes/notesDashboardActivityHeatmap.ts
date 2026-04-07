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
