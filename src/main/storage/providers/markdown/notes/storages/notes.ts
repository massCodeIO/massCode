import type {
  NoteCreateInput,
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
import { normalizeFlag } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
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
import { throwStorageError, validateEntryName } from '../../runtime/validation'
import { getNotesPaths } from '../runtime/constants'
import { findNoteById, persistNote, writeNoteToFile } from '../runtime/notes'
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
    content: note.content,
    createdAt: note.createdAt,
    description: note.description,
    folder,
    id: note.id,
    isDeleted: note.isDeleted,
    isFavorites: note.isFavorites,
    name: note.name,
    tags,
    updatedAt: note.updatedAt,
  }
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
      const matchedIds = query.search
        ? getNoteIdsBySearchQuery(notes, query.search)
        : null
      const filtered = filterAndSortByQuery({
        entities: notes,
        filters: [
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
        ],
        getSortValue: note => note.createdAt,
        query,
      })

      return filtered.map(n => createNoteRecord(n, state))
    },
    getNoteById(id: number): NoteRecord | null {
      const { state, notes } = getCache()
      const note = findNoteById(notes, id)

      return note ? createNoteRecord(note, state) : null
    },

    getNotesCounts(): NotesCount {
      const { notes } = getCache()
      return getEntityDeleteCounts(notes)
    },

    createNote(input: NoteCreateInput) {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)

      const name = validateEntryName(input.name, 'note')
      const folderId = input.folderId ?? null
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

      saveNotesState(paths, state)

      return result
    },

    updateNote(id: number, input: NoteUpdateInput): NoteUpdateResult {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)

      if (!note) {
        return { invalidInput: false, notFound: true }
      }

      const previousFilePath = note.filePath
      const updateResult = applyEntityUpdateFields({
        entity: note,
        fieldPresence: 'defined',
        folderExists: folderId => !!findNotesFolderById(state, folderId),
        input,
        normalizeFlag: value => normalizeFlag(value),
        onMissingFolder: () =>
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found'),
        resolveName: (inputName, currentName) =>
          validateEntryName(inputName ?? currentName, 'note'),
      })
      if (!updateResult.hasAnyField) {
        return { invalidInput: true, notFound: false }
      }

      note.updatedAt = Date.now()

      if (updateResult.pathMayChange) {
        persistNote(paths, state, note, previousFilePath, {
          allowRenameOnConflict: true,
        })
      }
      else {
        writeNoteToFile(paths, note)
      }

      saveNotesState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    updateNoteContent(id: number, content: string): NoteUpdateResult {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)
      const result = updateEntityBodyContent({
        content,
        entity: note,
        onAfterPersist: () => invalidateNotesSearchIndex(state),
        persistEntity: note => writeNoteToFile(paths, note),
      })

      return { invalidInput: false, notFound: result.notFound }
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
      return result
    },

    addTagToNote(noteId: number, tagId: number): NoteTagRelationResult {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, noteId)
      const tag = state.tags.find(t => t.id === tagId)
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
