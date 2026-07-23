import type {
  NoteCreateInput,
  NotePropertiesUpdateInput,
  NoteRecord,
  NotesCount,
  NotesQueryInput,
  NotesStorage,
  NoteTagDeleteRelationResult,
  NoteTagRelationResult,
  NoteUpdateInput,
  NoteUpdateResult,
} from '../../../../contracts'
import type { MarkdownNote, NotesState } from '../runtime/types'
import path from 'node:path'
import { isAfter, isToday, parseISO, startOfToday } from 'date-fns'
import { scheduleDockBadgeRefresh } from '../../../../../dockBadge'
import { prioritizeCloudDownload } from '../../cloudDownloads'
import { normalizeFlag } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
import {
  assertEntityFileWritable,
  markEntityPendingIfEvicted,
  markEntityPendingIfFileExists,
} from '../../runtime/shared/cloudGuards'
import { updateEntityBodyContent } from '../../runtime/shared/entityContent'
import { filterAndSortByQuery } from '../../runtime/shared/entityQuery'
import {
  addTagToEntity,
  applyEntityUpdateFields,
  createEntityInStateAndDisk,
  deleteEntityFromStateAndDisk,
  deleteTagFromEntity,
  emptyEntityTrashFromStateAndDisk,
  getEntityDeleteCounts,
} from '../../runtime/shared/entityStorage'
import {
  assertUniqueSiblingEntryName,
  assertVaultNotHydrating,
  throwStorageError,
  validateEntryName,
} from '../../runtime/validation'
import {
  promoteBareBacklinksAfterNoteCreate,
  rewriteBacklinksAfterNoteUpdate,
} from '../runtime/backlinks'
import { getNotesPaths } from '../runtime/constants'
import {
  ensureNoteContentLoaded,
  findNoteById,
  isNoteSystemFrontmatterKey,
  persistNote,
  writeNoteToFile,
} from '../runtime/notes'
import { findNotesFolderById } from '../runtime/paths'
import {
  getNoteIdsBySearchQuery,
  invalidateNotesSearchIndex,
} from '../runtime/search'
import { saveNotesState } from '../runtime/state'
import { getNotesRuntimeCache } from '../runtime/sync'

function createNoteRecord(note: MarkdownNote, state: NotesState): NoteRecord {
  let folder: { id: number, name: string } | null = null
  if (note.folderId !== null) {
    const f = findNotesFolderById(state, note.folderId)
    if (f) {
      folder = { id: f.id, name: f.name }
    }
  }

  const tags = note.tags
    .map((tagId) => {
      const t = state.tags.find(tag => tag.id === tagId)
      return t ? { id: t.id, name: t.name } : null
    })
    .filter((t): t is { id: number, name: string } => t !== null)

  return {
    // Ленивые записи отдают пустой контент: список его не сериализует, а
    // потокам с телом (getNoteById, поиск, graph) контент дочитывается до
    // построения record.
    content: note.content ?? '',
    createdAt: note.createdAt,
    description: note.description,
    folder,
    id: note.id,
    isDeleted: note.isDeleted,
    isFavorites: note.isFavorites,
    name: note.name,
    pendingCloudDownload: note.pendingCloudDownload === true,
    properties: note.properties,
    tags,
    updatedAt: note.updatedAt,
  }
}

function normalizePropertyText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizePropertyDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) {
      return undefined
    }

    const date = parseISO(normalized)
    if (!Number.isNaN(date.getTime())) {
      return date
    }

    const fallbackDate = new Date(normalized)
    return Number.isNaN(fallbackDate.getTime()) ? undefined : fallbackDate
  }

  if (typeof value !== 'number') {
    return undefined
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function applyNotePropertyFilters(
  note: MarkdownNote,
  query: NotesQueryInput,
): boolean {
  if (
    query.propertyType !== undefined
    && normalizePropertyText(note.properties.type) !== query.propertyType
  ) {
    return false
  }

  if (
    query.propertyStatus !== undefined
    && normalizePropertyText(note.properties.status) !== query.propertyStatus
  ) {
    return false
  }

  if (
    query.propertyStatusNot !== undefined
    && normalizePropertyText(note.properties.status) === query.propertyStatusNot
  ) {
    return false
  }

  if (
    query.hideCompletedTasks
    && normalizePropertyText(note.properties.type) === 'task'
    && normalizePropertyText(note.properties.status) === 'done'
  ) {
    return false
  }

  if (query.propertyDue !== undefined) {
    const due = normalizePropertyDate(note.properties.due)
    if (!due) {
      return false
    }

    if (query.propertyDue === 'today') {
      return isToday(due)
    }

    if (query.propertyDue === 'upcoming') {
      return isAfter(due, startOfToday()) && !isToday(due)
    }
  }

  return true
}

function applyNotePropertiesUpdate(
  note: MarkdownNote,
  input: NotePropertiesUpdateInput,
): boolean {
  let hasAnyField = false

  for (const [key, value] of Object.entries(input.properties || {})) {
    if (isNoteSystemFrontmatterKey(key)) {
      continue
    }

    note.properties[key] = value
    hasAnyField = true
  }

  for (const key of input.unset || []) {
    if (isNoteSystemFrontmatterKey(key)) {
      continue
    }

    if (Object.hasOwn(note.properties, key)) {
      delete note.properties[key]
      hasAnyField = true
    }
  }

  return hasAnyField
}

function createNoteProperties(
  inputProperties: Record<string, unknown> | undefined,
) {
  if (!inputProperties) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(inputProperties).filter(
      ([key]) => !isNoteSystemFrontmatterKey(key),
    ),
  )
}

export function createNotesNotesStorage(): NotesStorage {
  function resolvePaths() {
    return getNotesPaths(getVaultPath())
  }

  function getCache() {
    return getNotesRuntimeCache(resolvePaths())
  }

  return {
    getNotes(query: NotesQueryInput): NoteRecord[] {
      const { state, notes } = getCache()
      const search = query.search?.trim().toLowerCase()
      const matchedIds
        = search && !query.searchNameOnly
          ? getNoteIdsBySearchQuery(notes, search)
          : null
      const filtered = filterAndSortByQuery({
        entities: notes,
        filters: [
          note =>
            !search
            || !query.searchNameOnly
            || note.name.toLowerCase().includes(search),
          note => !matchedIds || matchedIds.has(note.id),
          (note, query) =>
            query.isDeleted !== undefined
              ? note.isDeleted === normalizeFlag(query.isDeleted)
              : note.isDeleted === 0,
          (note, query) =>
            query.folderId === undefined || note.folderId === query.folderId,
          (note, query) =>
            !(query.isInbox !== undefined && query.isInbox)
            || (note.folderId === null && note.isDeleted === 0),
          (note, query) =>
            !(query.isFavorites !== undefined && query.isFavorites)
            || note.isFavorites === 1,
          (note, query) =>
            query.tagId === undefined || note.tags.includes(query.tagId),
          (note, query) => applyNotePropertyFilters(note, query),
        ],
        getSortValue: (note, sort) => {
          if (sort === 'name') {
            return note.name.toLowerCase()
          }

          if (sort === 'updatedAt') {
            return note.updatedAt
          }

          return note.createdAt
        },
        query,
      })

      // Контент дочитывается до построения records: снимок content в record
      // не обновился бы от более поздней материализации.
      if (query.withContent) {
        filtered.forEach((note) => {
          ensureNoteContentLoaded(resolvePaths(), note)
        })
      }

      return filtered.map(n => createNoteRecord(n, state))
    },
    getNoteById(id: number): NoteRecord | null {
      const { state, notes } = getCache()
      const note = findNoteById(notes, id)

      // Пользователь открыл ещё не докачанную заметку: её файл поднимается
      // в начало очереди фоновой докачки, ответ при этом не блокируется.
      if (note?.pendingCloudDownload) {
        prioritizeCloudDownload(
          path.join(resolvePaths().notesRoot, note.filePath),
        )
      }

      // Запись из индекса без тела: контент дочитывается по первому запросу.
      // Сбой дочитки (файл выгружен после скана, флаг ещё не обновился)
      // помечает запись pending: успешный ответ с пустым content без флага
      // открыл бы редактируемый пустой редактор, и набранный текст потерялся
      // бы на 503 при сохранении. Для уже гидрированной записи eviction
      // ловится свежим stat. Флаг снимет ресинк после докачки.
      if (note) {
        if (!ensureNoteContentLoaded(resolvePaths(), note)) {
          markEntityPendingIfFileExists(
            path.join(resolvePaths().notesRoot, note.filePath),
            note,
          )
        }
        else {
          markEntityPendingIfEvicted(
            path.join(resolvePaths().notesRoot, note.filePath),
            note,
          )
        }
      }

      return note ? createNoteRecord(note, state) : null
    },

    getNotesCounts(): NotesCount {
      const { notes } = getCache()
      return getEntityDeleteCounts(notes)
    },

    createNote(input: NoteCreateInput) {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)

      assertVaultNotHydrating(state)
      const name = validateEntryName(input.name, 'note')
      const folderId = input.folderId ?? null
      assertUniqueSiblingEntryName(notes, folderId, name, 'note')
      const result = createEntityInStateAndDisk<MarkdownNote>({
        createEntity: ({ folderId, id, name, now }) => ({
          content: '',
          createdAt: now,
          description: null,
          filePath: '',
          folderId,
          id,
          isDeleted: 0,
          isFavorites: 0,
          name,
          properties: createNoteProperties(input.properties),
          tags: [],
          updatedAt: now,
        }),
        entities: notes,
        folderId,
        hasFolder: folderId => !!findNotesFolderById(state, folderId),
        name,
        nextId: () => {
          state.counters.noteId += 1
          return state.counters.noteId
        },
        onFolderNotFound: () =>
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found'),
        persistEntity: note =>
          persistNote(paths, state, note, undefined, {
            allowRenameOnConflict: true,
          }),
      })

      promoteBareBacklinksAfterNoteCreate({
        newNoteId: result.id,
        notes,
        paths,
        state,
      })

      saveNotesState(paths, state)
      scheduleDockBadgeRefresh()

      return result
    },

    updateNote(id: number, input: NoteUpdateInput): NoteUpdateResult {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)

      if (!note) {
        return { invalidInput: false, notFound: true }
      }

      // Проверка до мутации: иначе rename/move уже переместил бы файл и
      // изменил runtime/state, а запись frontmatter отклонилась.
      assertEntityFileWritable(path.join(paths.notesRoot, note.filePath), note)

      const previousFilePath = note.filePath
      const previousName = note.name
      const previousFolderId = note.folderId
      const updateResult = applyEntityUpdateFields({
        entity: note,
        fieldPresence: 'defined',
        folderExists: folderId => !!findNotesFolderById(state, folderId),
        input,
        normalizeFlag: value => normalizeFlag(value),
        onMissingFolder: () =>
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found'),
        resolveName: (inputName, currentName) => {
          const next = validateEntryName(inputName ?? currentName, 'note')
          const isFolderChanging
            = input.folderId !== undefined
              && (input.folderId ?? null) !== previousFolderId
          if (
            !isFolderChanging
            && next.toLowerCase() !== currentName.toLowerCase()
          ) {
            assertUniqueSiblingEntryName(
              notes,
              previousFolderId,
              next,
              'note',
              note.id,
            )
          }
          return next
        },
      })
      if (!updateResult.hasAnyField) {
        return { invalidInput: true, notFound: false }
      }

      note.updatedAt = Date.now()

      if (updateResult.pathMayChange) {
        persistNote(paths, state, note, previousFilePath, {
          allowRenameOnConflict: true,
          // assertEntityFileWritable выше уже проверил source до mutation.
          sourceFileVerifiedLocal: true,
        })
      }
      else {
        writeNoteToFile(paths, note)
      }

      if (note.name !== previousName || note.folderId !== previousFolderId) {
        rewriteBacklinksAfterNoteUpdate({
          nextFolderId: note.folderId,
          nextName: note.name,
          notes,
          paths,
          previousFolderId,
          previousName,
          state,
          updatedNoteId: note.id,
        })
      }

      saveNotesState(paths, state)
      scheduleDockBadgeRefresh()
      return { invalidInput: false, notFound: false }
    },

    updateNoteContent(id: number, content: string): NoteUpdateResult {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)

      // Проверка до мутации: updateEntityBodyContent меняет runtime до
      // записи файла.
      if (note) {
        assertEntityFileWritable(
          path.join(paths.notesRoot, note.filePath),
          note,
        )
      }

      const result = updateEntityBodyContent({
        content,
        entity: note,
        onAfterPersist: () => invalidateNotesSearchIndex(state),
        persistEntity: note => writeNoteToFile(paths, note),
      })

      return { invalidInput: false, notFound: result.notFound }
    },

    updateNoteProperties(
      id: number,
      input: NotePropertiesUpdateInput,
    ): NoteUpdateResult {
      const paths = resolvePaths()
      const { notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)

      if (!note) {
        return { invalidInput: false, notFound: true }
      }

      // Проверка со свежим stat до мутации: флаг pendingCloudDownload мог
      // устареть после eviction.
      assertEntityFileWritable(path.join(paths.notesRoot, note.filePath), note)

      const hasAnyField = applyNotePropertiesUpdate(note, input)

      if (!hasAnyField) {
        return { invalidInput: true, notFound: false }
      }

      note.updatedAt = Date.now()
      writeNoteToFile(paths, note)
      scheduleDockBadgeRefresh()

      return { invalidInput: false, notFound: false }
    },

    deleteNote(id: number) {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const result = deleteEntityFromStateAndDisk({
        id,
        rootPath: paths.notesRoot,
        runtimeEntities: notes,
        stateEntities: state.notes,
      })
      if (!result.deleted) {
        return result
      }

      saveNotesState(paths, state)
      scheduleDockBadgeRefresh()
      return result
    },

    emptyTrash() {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)

      const result = emptyEntityTrashFromStateAndDisk({
        rootPath: paths.notesRoot,
        runtimeEntities: notes,
        stateEntities: state.notes,
      })
      if (!result.deletedCount) {
        return result
      }

      saveNotesState(paths, state)
      scheduleDockBadgeRefresh()
      return result
    },

    addTagToNote(noteId: number, tagId: number): NoteTagRelationResult {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, noteId)
      const tag = state.tags.find(t => t.id === tagId)

      // Проверка до мутации: addTagToEntity меняет runtime до записи файла.
      if (note && tag) {
        assertEntityFileWritable(
          path.join(paths.notesRoot, note.filePath),
          note,
        )
      }

      const result = addTagToEntity({
        entity: note,
        onUpdated: note => writeNoteToFile(paths, note),
        tagExists: !!tag,
        tagId,
      })

      return {
        noteFound: result.entityFound,
        notFound: false,
        tagFound: result.tagFound,
      }
    },

    deleteTagFromNote(
      noteId: number,
      tagId: number,
    ): NoteTagDeleteRelationResult {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, noteId)
      const tag = state.tags.find(t => t.id === tagId)

      // Проверка до мутации: deleteTagFromEntity меняет runtime до записи
      // файла.
      if (note && tag) {
        assertEntityFileWritable(
          path.join(paths.notesRoot, note.filePath),
          note,
        )
      }

      const result = deleteTagFromEntity({
        entity: note,
        missingRelationFound: false,
        onUpdated: note => writeNoteToFile(paths, note),
        tagExists: !!tag,
        tagId,
      })

      return {
        noteFound: result.entityFound,
        notFound: false,
        relationFound: result.relationFound,
        tagFound: result.tagFound,
      }
    },
  }
}
