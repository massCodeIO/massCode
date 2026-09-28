export interface NotesHeatmapPalette {
  scale: [string, string, string, string, string]
}

export function getNotesHeatmapPalette(isDark: boolean): NotesHeatmapPalette {
  if (isDark) {
    return {
      scale: ['var(--background)', '#0e4429', '#006d32', '#26a641', '#39d353'],
    }
  }

  return {
    scale: ['var(--background)', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  }
}
