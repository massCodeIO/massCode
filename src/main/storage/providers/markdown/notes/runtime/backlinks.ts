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

interface PromoteBareBacklinksOnConflictInput {
  paths: NotesPaths
  state: NotesState
  notes: MarkdownNote[]
  preLookup: InternalLinkLookupItem[]
  postLookup: InternalLinkLookupItem[]
  conflictNoteIds: number[]
}

interface RewriteBacklinksAfterFolderUpdateInput {
  paths: NotesPaths
  state: NotesState
  notes: MarkdownNote[]
  oldFolderPathMap: Map<number, string>
  newFolderPathMap: Map<number, string>
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

function buildNoteLookupFromState(
  notes: MarkdownNote[],
  state: NotesState,
): InternalLinkLookupItem[] {
  const folderPathMap = buildNotesFolderPathMap(state)

  return notes
    .filter(note => note.isDeleted === 0)
    .map(note => ({
      folderPath:
        note.folderId === null ? '' : (folderPathMap.get(note.folderId) ?? ''),
      id: note.id,
      name: note.name,
      type: 'note' as const,
    }))
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

  if (nameChanged) {
    const nextKey = normalizeInternalLinkLookupKey(nextName)
    const otherConflictIds = postLookup
      .filter(
        item =>
          item.type === 'note'
          && item.id !== updatedNoteId
          && normalizeInternalLinkLookupKey(item.name) === nextKey,
      )
      .map(item => item.id)

    if (otherConflictIds.length > 0) {
      rewrittenCount += promoteBareBacklinksOnConflict({
        conflictNoteIds: otherConflictIds,
        notes,
        paths,
        postLookup,
        preLookup,
        state,
      })
    }
  }

  if (rewrittenCount > 0) {
    invalidateNotesSearchIndex(state)
  }

  return rewrittenCount
}

export function promoteBareBacklinksOnConflict(
  input: PromoteBareBacklinksOnConflictInput,
): number {
  const { paths, state, notes, preLookup, postLookup, conflictNoteIds } = input

  if (conflictNoteIds.length === 0) {
    return 0
  }

  const folderPathMap = buildNotesFolderPathMap(state)
  const noteFolderPath = (note: MarkdownNote): string =>
    note.folderId === null ? '' : (folderPathMap.get(note.folderId) ?? '')

  let total = 0
  const now = Date.now()
  const rewrittenLinkers = new Set<number>()

  for (const noteId of conflictNoteIds) {
    const targetItem = postLookup.find(
      item => item.type === 'note' && item.id === noteId,
    )
    if (!targetItem || !targetItem.folderPath) {
      continue
    }

    const targetKey = normalizeInternalLinkLookupKey(targetItem.name)
    const hasCollision = postLookup.some(
      item =>
        !(item.id === noteId && item.type === 'note')
        && normalizeInternalLinkLookupKey(item.name) === targetKey,
    )
    if (!hasCollision) {
      continue
    }

    const newTarget = `${targetItem.folderPath}/${targetItem.name}`

    for (const linker of notes) {
      if (linker.id === noteId || linker.isDeleted || !linker.content) {
        continue
      }

      const linkerFolderPath = noteFolderPath(linker)
      const rewritten = rewriteInternalLinks(linker.content, (match) => {
        if (match.legacyTarget) {
          return null
        }
        if (match.pathSegments.length > 0) {
          return null
        }
        if (normalizeInternalLinkLookupKey(match.basename) !== targetKey) {
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
          || resolved.id !== noteId
        ) {
          return null
        }

        return newTarget
      })

      if (rewritten === null) {
        continue
      }

      linker.content = rewritten
      linker.updatedAt = now
      writeNoteToFile(paths, linker)
      if (!rewrittenLinkers.has(linker.id)) {
        rewrittenLinkers.add(linker.id)
        total++
      }
    }
  }

  if (total > 0) {
    invalidateNotesSearchIndex(state)
  }

  return total
}

export function rewriteBacklinksAfterFolderUpdate(
  input: RewriteBacklinksAfterFolderUpdateInput,
): number {
  const { paths, state, notes, oldFolderPathMap, newFolderPathMap } = input

  const affectedFolderIds = new Set<number>()
  for (const folder of state.folders) {
    if (oldFolderPathMap.get(folder.id) !== newFolderPathMap.get(folder.id)) {
      affectedFolderIds.add(folder.id)
    }
  }

  if (affectedFolderIds.size === 0) {
    return 0
  }

  const affectedNoteIds = new Set<number>()
  for (const note of notes) {
    if (
      note.isDeleted === 0
      && note.folderId !== null
      && affectedFolderIds.has(note.folderId)
    ) {
      affectedNoteIds.add(note.id)
    }
  }

  if (affectedNoteIds.size === 0) {
    return 0
  }

  const snippetLookup = loadSnippetLookup()

  const buildLookup = (
    folderPathMap: Map<number, string>,
  ): InternalLinkLookupItem[] => [
    ...snippetLookup,
    ...notes
      .filter(note => note.isDeleted === 0)
      .map(note => ({
        folderPath:
          note.folderId === null
            ? ''
            : (folderPathMap.get(note.folderId) ?? ''),
        id: note.id,
        name: note.name,
        type: 'note' as const,
      })),
  ]

  const preLookup = buildLookup(oldFolderPathMap)
  const postLookup = buildLookup(newFolderPathMap)

  const shortestUniqueCandidates: ShortestUniqueLookupItem[] = postLookup.map(
    item => ({
      folderPath: item.folderPath ?? '',
      id: item.id,
      name: item.name,
      type: item.type,
    }),
  )

  let rewrittenCount = 0
  const now = Date.now()

  for (const linker of notes) {
    if (linker.isDeleted || !linker.content) {
      continue
    }

    const oldLinkerFolderPath
      = linker.folderId === null
        ? ''
        : (oldFolderPathMap.get(linker.folderId) ?? '')

    const rewritten = rewriteInternalLinks(linker.content, (match) => {
      if (match.legacyTarget) {
        return null
      }
      if (match.pathSegments.length === 0) {
        return null
      }

      const resolved = resolveInternalLinkTargetByTitle(
        match.target,
        preLookup,
        { linkerFolderPath: oldLinkerFolderPath },
      )
      if (
        resolved === null
        || resolved.type !== 'note'
        || !affectedNoteIds.has(resolved.id)
      ) {
        return null
      }

      const targetItem = postLookup.find(
        item => item.type === 'note' && item.id === resolved.id,
      )
      if (!targetItem) {
        return null
      }

      const newTarget = pickShortestUniqueLinkTarget(
        {
          folderPath: targetItem.folderPath ?? '',
          id: targetItem.id,
          name: targetItem.name,
          type: 'note',
        },
        shortestUniqueCandidates,
      )

      if (newTarget === match.target) {
        return null
      }

      return newTarget
    })

    if (rewritten === null) {
      continue
    }

    linker.content = rewritten
    linker.updatedAt = now
    writeNoteToFile(paths, linker)
    rewrittenCount++
  }

  if (rewrittenCount > 0) {
    invalidateNotesSearchIndex(state)
  }

  return rewrittenCount
}

export function promoteBareBacklinksAfterNoteCreate(input: {
  paths: NotesPaths
  state: NotesState
  notes: MarkdownNote[]
  newNoteId: number
}): number {
  const { paths, state, notes, newNoteId } = input

  const newNote = notes.find(note => note.id === newNoteId)
  if (!newNote || newNote.isDeleted) {
    return 0
  }

  const newNameKey = normalizeInternalLinkLookupKey(newNote.name)
  const conflictNoteIds = notes
    .filter(
      note =>
        note.id !== newNoteId
        && note.isDeleted === 0
        && normalizeInternalLinkLookupKey(note.name) === newNameKey,
    )
    .map(note => note.id)

  if (conflictNoteIds.length === 0) {
    return 0
  }

  const snippetLookup = loadSnippetLookup()
  const noteLookup = buildNoteLookupFromState(notes, state)
  const postLookup = [...snippetLookup, ...noteLookup]
  const preLookup = [
    ...snippetLookup,
    ...noteLookup.filter(item => item.id !== newNoteId),
  ]

  return promoteBareBacklinksOnConflict({
    conflictNoteIds,
    notes,
    paths,
    postLookup,
    preLookup,
    state,
  })
}
