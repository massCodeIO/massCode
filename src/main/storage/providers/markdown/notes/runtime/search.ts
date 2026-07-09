import type { MarkdownNote, NotesState } from './types'
import {
  buildSearchIndex,
  invalidateSearchIndex,
  querySearchIndex,
} from '../../runtime/shared/searchEngine'
import { notesRuntimeRef } from './constants'
import { ensureAllNoteContentsLoaded } from './notes'

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

  // Полнотекстовый поиск требует тел: ленивые записи (построенные из
  // индекса без чтения файлов) дочитываются перед построением поискового
  // индекса. Стоимость — одно чтение файла на запись при первом поиске.
  if (runtimeCache && ensureAllNoteContentsLoaded(runtimeCache.paths, notes)) {
    invalidateSearchIndex(runtimeCache.searchIndex)
  }

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
