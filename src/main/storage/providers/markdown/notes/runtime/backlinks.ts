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

interface RewriteBacklinksAfterNoteUpdateInput {
  paths: NotesPaths
  state: NotesState
  notes: MarkdownNote[]
  updatedNoteId: number
  previousName: string
  nextName: string
  previousFolderId: number | null
  nextFolderId: number | null
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

export function rewriteBacklinksAfterNoteUpdate(
  input: RewriteBacklinksAfterNoteUpdateInput,
): number {
  const {
    paths,
    state,
    notes,
    updatedNoteId,
    previousName,
    nextName,
    previousFolderId,
    nextFolderId,
  } = input

  const previousKey = normalizeInternalLinkLookupKey(previousName)
  if (!previousKey) {
    return 0
  }

  const nameChanged = previousKey !== normalizeInternalLinkLookupKey(nextName)
  const folderChanged = previousFolderId !== nextFolderId
  if (!nameChanged && !folderChanged) {
    return 0
  }

  const snippetLookup = loadSnippetLookup()
  const folderPathMap = buildNotesFolderPathMap(state)

  const resolveFolderPath = (folderId: number | null): string =>
    folderId === null ? '' : (folderPathMap.get(folderId) ?? '')

  const previousFolderPath = resolveFolderPath(previousFolderId)
  const nextFolderPath = resolveFolderPath(nextFolderId)

  const buildNoteLookup = (
    appliedNameAndFolder: 'previous' | 'next',
  ): InternalLinkLookupItem[] =>
    notes
      .filter(note => note.isDeleted === 0)
      .map((note) => {
        if (note.id !== updatedNoteId) {
          return {
            folderPath:
              note.folderId === null
                ? ''
                : (folderPathMap.get(note.folderId) ?? ''),
            id: note.id,
            name: note.name,
            type: 'note' as const,
          }
        }

        return {
          folderPath:
            appliedNameAndFolder === 'previous'
              ? previousFolderPath
              : nextFolderPath,
          id: note.id,
          name: appliedNameAndFolder === 'previous' ? previousName : nextName,
          type: 'note' as const,
        }
      })

  const preLookup = [...snippetLookup, ...buildNoteLookup('previous')]
  const postLookup = [...snippetLookup, ...buildNoteLookup('next')]

  const shortestUniqueCandidates: ShortestUniqueLookupItem[] = postLookup.map(
    item => ({
      folderPath: item.folderPath ?? '',
      id: item.id,
      name: item.name,
      type: item.type,
    }),
  )
  const updatedTarget = pickShortestUniqueLinkTarget(
    {
      folderPath: nextFolderPath,
      id: updatedNoteId,
      name: nextName,
      type: 'note',
    },
    shortestUniqueCandidates,
  )

  let rewrittenCount = 0
  const now = Date.now()

  for (const note of notes) {
    if (note.id === updatedNoteId || note.isDeleted || !note.content) {
      continue
    }

    const linkerFolderPath
      = note.folderId === null ? '' : (folderPathMap.get(note.folderId) ?? '')

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
        || resolved.id !== updatedNoteId
      ) {
        return null
      }

      return updatedTarget
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
