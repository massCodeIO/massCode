import type {
  InternalLinkLookupItem,
  InternalLinkMatch,
} from '../../../../../../shared/notes/internalLinks'
import type { MarkdownNote, NotesPaths, NotesState } from './types'
import {
  normalizeInternalLinkLookupKey,
  resolveInternalLinkTargetByTitle,
  rewriteInternalLinkTarget,
} from '../../../../../../shared/notes/internalLinks'
import { getPaths, getVaultPath } from '../../runtime/paths'
import { getRuntimeCache } from '../../runtime/sync'
import { writeNoteToFile } from './notes'
import { buildNotesFolderPathMap } from './paths'
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

  let snippetLookup: InternalLinkLookupItem[] = []
  try {
    const markdownCache = getRuntimeCache(getPaths(getVaultPath()))
    snippetLookup = markdownCache.snippets
      .filter(snippet => snippet.isDeleted === 0)
      .map(snippet => ({
        id: snippet.id,
        name: snippet.name,
        type: 'snippet' as const,
      }))
  }
  catch {
    snippetLookup = []
  }

  if (
    snippetLookup.some(
      snippet => normalizeInternalLinkLookupKey(snippet.name) === previousKey,
    )
  ) {
    return 0
  }

  const folderPathMap = buildNotesFolderPathMap(state)

  const getNoteFolderPath = (note: MarkdownNote): string =>
    note.folderId === null ? '' : (folderPathMap.get(note.folderId) ?? '')

  const noteLookup: InternalLinkLookupItem[] = notes
    .filter(note => note.isDeleted === 0)
    .map(note => ({
      folderPath: getNoteFolderPath(note),
      id: note.id,
      name: note.id === renamedNoteId ? previousName : note.name,
      type: 'note' as const,
    }))

  const lookup = [...snippetLookup, ...noteLookup]

  let rewrittenCount = 0
  const now = Date.now()

  for (const note of notes) {
    if (note.id === renamedNoteId || note.isDeleted || !note.content) {
      continue
    }

    const linkerFolderPath = getNoteFolderPath(note)
    const shouldRewriteMatch = (match: InternalLinkMatch): boolean => {
      const resolved = resolveInternalLinkTargetByTitle(match.target, lookup, {
        linkerFolderPath,
      })
      return (
        resolved !== null
        && resolved.type === 'note'
        && resolved.id === renamedNoteId
      )
    }

    const rewritten = rewriteInternalLinkTarget(
      note.content,
      previousName,
      nextName,
      shouldRewriteMatch,
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
