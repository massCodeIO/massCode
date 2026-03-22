import type { MarkdownNote, NotesState } from './types'
import {
  buildSearchIndex,
  invalidateSearchIndex,
  querySearchIndex,
} from '../../runtime/shared/searchEngine'
import { notesRuntimeRef } from './constants'

export function buildNoteSearchText(note: MarkdownNote): string {
  const parts: string[] = [note.name]
  if (note.description) {
    parts.push(note.description)
  }
  if (note.content) {
    parts.push(note.content)
  }
  return parts.join(' ')
}

export function getNoteIdsBySearchQuery(
  notes: MarkdownNote[],
  searchQuery: string,
): Set<number> {
  const cache = notesRuntimeRef.cache
  const runtimeCache = cache?.notes === notes ? cache : null

  if (runtimeCache && runtimeCache.searchIndex.dirty) {
    runtimeCache.searchIndex = buildSearchIndex(notes, buildNoteSearchText)
  }

  return querySearchIndex(
    notes,
    searchQuery,
    runtimeCache?.searchIndex ?? null,
    buildNoteSearchText,
  )
}

export function invalidateNotesSearchIndex(state: NotesState): void {
  const cache = notesRuntimeRef.cache
  if (!cache || cache.state !== state) {
    return
  }

  invalidateSearchIndex(cache.searchIndex)
}

export { buildSearchIndex }
