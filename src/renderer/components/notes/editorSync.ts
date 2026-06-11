interface SyncableSelectedNote {
  id: number
  // content отсутствует, пока полная запись выбранной заметки загружается
  content?: string
}

export function shouldSyncSelectedNoteContent(
  previousNote: SyncableSelectedNote | null | undefined,
  nextNote: SyncableSelectedNote | null | undefined,
): boolean {
  return (
    previousNote?.id !== nextNote?.id
    || previousNote?.content !== nextNote?.content
  )
}
