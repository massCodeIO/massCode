import type { InternalLinkLookupItem } from '../../../../../../shared/notes/internalLinks'
import type { MarkdownNote, NotesPaths, NotesState } from './types'
import {
  normalizeInternalLinkLookupKey,
  rewriteInternalLinks,
} from '../../../../../../shared/notes/internalLinks'
import { getPaths, getVaultPath } from '../../runtime/paths'
import { getRuntimeCache } from '../../runtime/sync'
import { createInternalLinkResolver } from './internalLinkResolver'
import { ensureAllNoteContentsLoaded, writeNoteToFile } from './notes'
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

function buildLookupKeyCounts(
  items: InternalLinkLookupItem[],
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const item of items) {
    const key = normalizeInternalLinkLookupKey(item.name)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

/**
 * The selected item is expected to be present in the lookup the counts were
 * built from, so a collision exists when its key occurs more than once.
 */
function pickShortestUniqueLinkTarget(
  name: string,
  folderPath: string,
  lookupKeyCounts: Map<string, number>,
): string {
  const hasCollision
    = (lookupKeyCounts.get(normalizeInternalLinkLookupKey(name)) ?? 0) > 1

  if (!hasCollision || !folderPath) {
    return name
  }

  return `${folderPath}/${name}`
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

  // Переписывание [[ссылок]] сканирует тела всех заметок: ленивые записи
  // сначала дочитываются, иначе их ссылки молча остались бы битыми.
  ensureAllNoteContentsLoaded(paths, notes)

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
  const preResolver = createInternalLinkResolver(preLookup)
  const postLookupKeyCounts = buildLookupKeyCounts(postLookup)

  const updatedTarget = pickShortestUniqueLinkTarget(
    nextName,
    nextFolderPath,
    postLookupKeyCounts,
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

      const resolved = preResolver.resolve(match.target, { linkerFolderPath })
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

  // Переписывание [[ссылок]] сканирует тела всех заметок: ленивые записи
  // сначала дочитываются, иначе их ссылки молча остались бы битыми.
  ensureAllNoteContentsLoaded(paths, notes)

  const folderPathMap = buildNotesFolderPathMap(state)
  const noteFolderPath = (note: MarkdownNote): string =>
    note.folderId === null ? '' : (folderPathMap.get(note.folderId) ?? '')

  const preResolver = createInternalLinkResolver(preLookup)
  const postLookupKeyCounts = buildLookupKeyCounts(postLookup)
  const postNoteItemById = new Map<number, InternalLinkLookupItem>()
  for (const item of postLookup) {
    if (item.type === 'note' && !postNoteItemById.has(item.id)) {
      postNoteItemById.set(item.id, item)
    }
  }

  let total = 0
  const now = Date.now()
  const rewrittenLinkers = new Set<number>()

  for (const noteId of conflictNoteIds) {
    const targetItem = postNoteItemById.get(noteId)
    if (!targetItem || !targetItem.folderPath) {
      continue
    }

    const targetKey = normalizeInternalLinkLookupKey(targetItem.name)
    const hasCollision = (postLookupKeyCounts.get(targetKey) ?? 0) > 1
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

        const resolved = preResolver.resolve(match.target, {
          linkerFolderPath,
        })
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

  // Переписывание [[ссылок]] сканирует тела всех заметок: ленивые записи
  // сначала дочитываются, иначе их ссылки молча остались бы битыми.
  ensureAllNoteContentsLoaded(paths, notes)

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
  const preResolver = createInternalLinkResolver(preLookup)
  const postLookupKeyCounts = buildLookupKeyCounts(postLookup)
  const postNoteItemById = new Map<number, InternalLinkLookupItem>()
  for (const item of postLookup) {
    if (item.type === 'note' && !postNoteItemById.has(item.id)) {
      postNoteItemById.set(item.id, item)
    }
  }

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

      const resolved = preResolver.resolve(match.target, {
        linkerFolderPath: oldLinkerFolderPath,
      })
      if (
        resolved === null
        || resolved.type !== 'note'
        || !affectedNoteIds.has(resolved.id)
      ) {
        return null
      }

      const targetItem = postNoteItemById.get(resolved.id)
      if (!targetItem) {
        return null
      }

      const newTarget = pickShortestUniqueLinkTarget(
        targetItem.name,
        targetItem.folderPath ?? '',
        postLookupKeyCounts,
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
