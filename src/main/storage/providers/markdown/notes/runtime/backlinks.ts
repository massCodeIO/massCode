import type { MarkdownNote, NotesPaths, NotesState } from './types'
import {
  normalizeInternalLinkLookupKey,
  rewriteInternalLinkTarget,
} from '../../../../../../shared/notes/internalLinks'
import { getPaths, getVaultPath } from '../../runtime/paths'
import { getRuntimeCache } from '../../runtime/sync'
import { writeNoteToFile } from './notes'
import { invalidateNotesSearchIndex } from './search'

interface RewriteBacklinksAfterRenameInput {
  paths: NotesPaths
  state: NotesState
  notes: MarkdownNote[]
  renamedNoteId: number
  previousName: string
  nextName: string
}

export function rewriteBacklinksAfterNoteRename(
  input: RewriteBacklinksAfterRenameInput,
): number {
  const { paths, state, notes, renamedNoteId, previousName, nextName } = input

  const previousKey = normalizeInternalLinkLookupKey(previousName)
  if (!previousKey) {
    return 0
  }

  if (previousKey === normalizeInternalLinkLookupKey(nextName)) {
    return 0
  }

  if (
    notes.some(
      note =>
        note.id !== renamedNoteId
        && note.isDeleted === 0
        && normalizeInternalLinkLookupKey(note.name) === previousKey,
    )
  ) {
    return 0
  }

  let snippetShadowsName = false
  try {
    const markdownCache = getRuntimeCache(getPaths(getVaultPath()))
    snippetShadowsName = markdownCache.snippets.some(
      snippet =>
        snippet.isDeleted === 0
        && normalizeInternalLinkLookupKey(snippet.name) === previousKey,
    )
  }
  catch {
    snippetShadowsName = false
  }

  if (snippetShadowsName) {
    return 0
  }

  let rewrittenCount = 0
  const now = Date.now()

  for (const note of notes) {
    if (note.id === renamedNoteId || note.isDeleted || !note.content) {
      continue
    }

    const rewritten = rewriteInternalLinkTarget(
      note.content,
      previousName,
      nextName,
    )
    if (rewritten === null) {
      continue
    }

    note.content = rewritten
    note.updatedAt = now
    writeNoteToFile(paths, note)
    rewrittenCount++
  }

  if (rewrittenCount > 0) {
    invalidateNotesSearchIndex(state)
  }

  return rewrittenCount
}
