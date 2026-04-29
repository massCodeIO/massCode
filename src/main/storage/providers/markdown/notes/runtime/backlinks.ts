import type {
  InternalLinkLookupItem,
  InternalLinkType,
} from '../../../../../../shared/notes/internalLinks'
import type { MarkdownNote, NotesPaths, NotesState } from './types'
import {
  normalizeInternalLinkLookupKey,
  resolveInternalLinkTargetByTitle,
  rewriteInternalLinks,
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

interface ShortestUniqueLookupItem {
  id: number
  type: InternalLinkType
  name: string
  folderPath: string
}

function pickShortestUniqueLinkTarget(
  selected: ShortestUniqueLookupItem,
  candidates: ShortestUniqueLookupItem[],
): string {
  const selectedKey = normalizeInternalLinkLookupKey(selected.name)
  const hasCollision = candidates.some(
    candidate =>
      !(candidate.id === selected.id && candidate.type === selected.type)
      && normalizeInternalLinkLookupKey(candidate.name) === selectedKey,
  )

  if (!hasCollision || !selected.folderPath) {
    return selected.name
  }

  return `${selected.folderPath}/${selected.name}`
}

function loadSnippetLookup(): InternalLinkLookupItem[] {
  try {
    const markdownCache = getRuntimeCache(getPaths(getVaultPath()))
    return markdownCache.snippets
      .filter(snippet => snippet.isDeleted === 0)
      .map(snippet => ({
        id: snippet.id,
        name: snippet.name,
        type: 'snippet' as const,
      }))
  }
  catch {
    return []
  }
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

  const snippetLookup = loadSnippetLookup()
  const folderPathMap = buildNotesFolderPathMap(state)

  const getNoteFolderPath = (note: MarkdownNote): string =>
    note.folderId === null ? '' : (folderPathMap.get(note.folderId) ?? '')

  const buildNoteLookup = (renameApplied: boolean): InternalLinkLookupItem[] =>
    notes
      .filter(note => note.isDeleted === 0)
      .map(note => ({
        folderPath: getNoteFolderPath(note),
        id: note.id,
        name:
          note.id === renamedNoteId
            ? renameApplied
              ? nextName
              : previousName
            : note.name,
        type: 'note' as const,
      }))

  const preLookup = [...snippetLookup, ...buildNoteLookup(false)]
  const postLookup = [...snippetLookup, ...buildNoteLookup(true)]

  const renamedNote = notes.find(note => note.id === renamedNoteId)
  if (!renamedNote) {
    return 0
  }

  const renamedFolderPath = getNoteFolderPath(renamedNote)
  const shortestUniqueCandidates: ShortestUniqueLookupItem[] = postLookup.map(
    item => ({
      folderPath: item.folderPath ?? '',
      id: item.id,
      name: item.name,
      type: item.type,
    }),
  )
  const renamedTarget = pickShortestUniqueLinkTarget(
    {
      folderPath: renamedFolderPath,
      id: renamedNoteId,
      name: nextName,
      type: 'note',
    },
    shortestUniqueCandidates,
  )

  let rewrittenCount = 0
  const now = Date.now()

  for (const note of notes) {
    if (note.id === renamedNoteId || note.isDeleted || !note.content) {
      continue
    }

    const linkerFolderPath = getNoteFolderPath(note)
    const rewritten = rewriteInternalLinks(note.content, (match) => {
      if (match.legacyTarget) {
        return null
      }

      const resolved = resolveInternalLinkTargetByTitle(
        match.target,
        preLookup,
        { linkerFolderPath },
      )
      if (
        resolved === null
        || resolved.type !== 'note'
        || resolved.id !== renamedNoteId
      ) {
        return null
      }

      return renamedTarget
    })

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
