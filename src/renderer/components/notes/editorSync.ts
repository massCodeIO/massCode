interface SyncableSelectedNote {
  id: number
  // content отсутствует, пока полная запись выбранной заметки загружается
  content?: string
}

export interface EmittedNoteContent {
  noteId: number | undefined
  value: string
}

export function isOwnNoteContentEcho(
  emitted: EmittedNoteContent | undefined,
  noteId: number | undefined,
  value: string,
): boolean {
  return emitted?.noteId === noteId && emitted.value === value
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
