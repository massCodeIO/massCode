import type { InternalLinkLookupItem } from '../../../../../../shared/notes/internalLinks'
import type {
  DeferredBacklinkRewriteOp,
  MarkdownNote,
  NotesPaths,
  NotesState,
} from './types'
import {
  normalizeInternalLinkLookupKey,
  rewriteInternalLinks,
} from '../../../../../../shared/notes/internalLinks'
import { getPaths, getVaultPath } from '../../runtime/paths'
import { getRuntimeCache } from '../../runtime/sync'
import { createInternalLinkResolver } from './internalLinkResolver'
import {
  ensureAllNoteContentsLoaded,
  ensureNoteContentLoaded,
  writeNoteToFile,
} from './notes'
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

// Отложенные rewrite'ы для заметок, чьё содержимое ещё не докачано из
// облака в момент rename/move: применяются при гидрации заметки, чтобы её
// [[ссылки]] не остались указывать на старое имя. Очередь хранится в
// notes state сериализуемыми спеками (DeferredBacklinkRewriteOp) и потому
// переживает перезапуск приложения и смену vault.

function addPendingLinkerToOp(
  op: DeferredBacklinkRewriteOp,
  noteId: number,
  linkerFolderPath: string,
): void {
  if (!op.pendingNoteIds.includes(noteId)) {
    op.pendingNoteIds.push(noteId)
  }

  op.linkerFolderPathByNoteId[String(noteId)] = linkerFolderPath
}

function queueDeferredBacklinkRewriteOp(
  state: NotesState,
  op: DeferredBacklinkRewriteOp,
): void {
  if (!op.pendingNoteIds.length) {
    return
  }

  state.deferredBacklinkRewrites ??= []
  state.deferredBacklinkRewrites.push(op)
}

function removeNoteFromDeferredOps(state: NotesState, noteId: number): void {
  if (!state.deferredBacklinkRewrites) {
    return
  }

  for (const op of state.deferredBacklinkRewrites) {
    const index = op.pendingNoteIds.indexOf(noteId)
    if (index !== -1) {
      op.pendingNoteIds.splice(index, 1)
      delete op.linkerFolderPathByNoteId[String(noteId)]
    }
  }

  state.deferredBacklinkRewrites = state.deferredBacklinkRewrites.filter(
    op => op.pendingNoteIds.length > 0,
  )

  if (!state.deferredBacklinkRewrites.length) {
    delete state.deferredBacklinkRewrites
  }
}

// Восстанавливает rewrite-функцию из сериализованной спеки: резолвит каждую
// [[ссылку]] по lookup имён до переименования и подменяет target, если
// ссылка указывала на переименованную заметку.
function buildDeferredRewrite(
  op: DeferredBacklinkRewriteOp,
  noteId: number,
): (content: string) => string | null {
  const resolver = createInternalLinkResolver(op.preLookup)
  const linkerFolderPath = op.linkerFolderPathByNoteId[String(noteId)] ?? ''

  return content =>
    rewriteInternalLinks(content, (match) => {
      if (match.legacyTarget) {
        return null
      }
      if (op.linkKind === 'bare' && match.pathSegments.length > 0) {
        return null
      }
      if (op.linkKind === 'path' && match.pathSegments.length === 0) {
        return null
      }

      const resolved = resolver.resolve(match.target, { linkerFolderPath })
      if (resolved === null || resolved.type !== 'note') {
        return null
      }

      const newTarget = op.targetsById[String(resolved.id)]
      if (newTarget === undefined || newTarget === match.target) {
        return null
      }

      return newTarget
    })
}

export function applyDeferredBacklinkRewrites(
  paths: NotesPaths,
  state: NotesState,
  note: MarkdownNote,
): boolean {
  const ops = state.deferredBacklinkRewrites?.filter(op =>
    op.pendingNoteIds.includes(note.id),
  )
  if (!ops?.length || note.pendingCloudDownload) {
    return false
  }

  if (note.content === null && !ensureNoteContentLoaded(paths, note)) {
    return false
  }

  let content = note.content ?? ''
  let changed = false

  for (const op of ops) {
    const rewritten = buildDeferredRewrite(op, note.id)(content)
    if (rewritten !== null) {
      content = rewritten
      changed = true
    }
  }

  if (changed) {
    note.content = content
    note.updatedAt = Date.now()

    // Файл испарился между гидрацией и записью (eviction): заметка остаётся
    // в очереди, rewrite применится при следующей гидрации.
    if (!writeNoteToFile(paths, note, { skipIfUnavailable: true })) {
      return false
    }

    invalidateNotesSearchIndex(state)
  }

  removeNoteFromDeferredOps(state, note.id)

  return changed
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

  const deferredOp: DeferredBacklinkRewriteOp = {
    linkKind: 'any',
    linkerFolderPathByNoteId: {},
    pendingNoteIds: [],
    preLookup,
    targetsById: { [String(updatedNoteId)]: updatedTarget },
  }

  const rewriteLinkerContent = (
    content: string,
    linkerFolderPath: string,
  ): string | null =>
    rewriteInternalLinks(content, (match) => {
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

  for (const note of notes) {
    if (note.id === updatedNoteId || note.isDeleted) {
      continue
    }

    const linkerFolderPath
      = note.folderId === null ? '' : (folderPathMap.get(note.folderId) ?? '')

    // Тело ещё в облаке — rewrite откладывается и применится при гидрации.
    // content === null означает, что тело не догрузилось (файл стал
    // placeholder после скана, флаг ещё не обновился): тоже откладываем.
    if (note.pendingCloudDownload || note.content === null) {
      addPendingLinkerToOp(deferredOp, note.id, linkerFolderPath)
      continue
    }

    if (!note.content) {
      continue
    }

    const rewritten = rewriteLinkerContent(note.content, linkerFolderPath)

    if (rewritten === null) {
      continue
    }

    note.content = rewritten
    note.updatedAt = now

    // Файл испарился между проверкой и записью (eviction): rewrite
    // откладывается и применится при гидрации.
    if (!writeNoteToFile(paths, note, { skipIfUnavailable: true })) {
      addPendingLinkerToOp(deferredOp, note.id, linkerFolderPath)
      continue
    }

    rewrittenCount++
  }

  queueDeferredBacklinkRewriteOp(state, deferredOp)

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

    const deferredOp: DeferredBacklinkRewriteOp = {
      linkKind: 'bare',
      linkerFolderPathByNoteId: {},
      pendingNoteIds: [],
      preLookup,
      targetsById: { [String(noteId)]: newTarget },
    }

    const rewriteLinkerContent = (
      content: string,
      linkerFolderPath: string,
    ): string | null =>
      rewriteInternalLinks(content, (match) => {
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

    for (const linker of notes) {
      if (linker.id === noteId || linker.isDeleted) {
        continue
      }

      const linkerFolderPath = noteFolderPath(linker)

      // Тело ещё в облаке — rewrite откладывается и применится при
      // гидрации. content === null означает, что тело не догрузилось (файл
      // стал placeholder после скана, флаг ещё не обновился): тоже
      // откладываем.
      if (linker.pendingCloudDownload || linker.content === null) {
        addPendingLinkerToOp(deferredOp, linker.id, linkerFolderPath)
        continue
      }

      if (!linker.content) {
        continue
      }

      const rewritten = rewriteLinkerContent(linker.content, linkerFolderPath)

      if (rewritten === null) {
        continue
      }

      linker.content = rewritten
      linker.updatedAt = now

      // Файл испарился между проверкой и записью (eviction): rewrite
      // откладывается и применится при гидрации.
      if (!writeNoteToFile(paths, linker, { skipIfUnavailable: true })) {
        addPendingLinkerToOp(deferredOp, linker.id, linkerFolderPath)
        continue
      }

      if (!rewrittenLinkers.has(linker.id)) {
        rewrittenLinkers.add(linker.id)
        total++
      }
    }

    queueDeferredBacklinkRewriteOp(state, deferredOp)
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

  // Новый target детерминирован по id цели: карта собирается заранее, чтобы
  // отложенный rewrite восстанавливался из сериализуемой спеки.
  const targetsById: Record<string, string> = {}
  for (const noteId of affectedNoteIds) {
    const targetItem = postNoteItemById.get(noteId)
    if (targetItem) {
      targetsById[String(noteId)] = pickShortestUniqueLinkTarget(
        targetItem.name,
        targetItem.folderPath ?? '',
        postLookupKeyCounts,
      )
    }
  }

  const deferredOp: DeferredBacklinkRewriteOp = {
    linkKind: 'path',
    linkerFolderPathByNoteId: {},
    pendingNoteIds: [],
    preLookup,
    targetsById,
  }

  const rewriteLinkerContent = (
    content: string,
    oldLinkerFolderPath: string,
  ): string | null =>
    rewriteInternalLinks(content, (match) => {
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

  for (const linker of notes) {
    if (linker.isDeleted) {
      continue
    }

    const oldLinkerFolderPath
      = linker.folderId === null
        ? ''
        : (oldFolderPathMap.get(linker.folderId) ?? '')

    // Тело ещё в облаке — rewrite откладывается и применится при гидрации.
    // content === null означает, что тело не догрузилось (файл стал
    // placeholder после скана, флаг ещё не обновился): тоже откладываем.
    if (linker.pendingCloudDownload || linker.content === null) {
      addPendingLinkerToOp(deferredOp, linker.id, oldLinkerFolderPath)
      continue
    }

    if (!linker.content) {
      continue
    }

    const rewritten = rewriteLinkerContent(linker.content, oldLinkerFolderPath)

    if (rewritten === null) {
      continue
    }

    linker.content = rewritten
    linker.updatedAt = now

    // Файл испарился между проверкой и записью (eviction): rewrite
    // откладывается и применится при гидрации.
    if (!writeNoteToFile(paths, linker, { skipIfUnavailable: true })) {
      addPendingLinkerToOp(deferredOp, linker.id, oldLinkerFolderPath)
      continue
    }

    rewrittenCount++
  }

  queueDeferredBacklinkRewriteOp(state, deferredOp)

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
