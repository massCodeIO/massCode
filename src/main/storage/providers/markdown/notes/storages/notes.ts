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
import {
  addTagToEntity,
  createEntityInStateAndDisk,
  deleteEntityFromStateAndDisk,
  emptyEntityTrashFromStateAndDisk,
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

      let filtered = notes

      if (query.isDeleted !== undefined) {
        filtered = filtered.filter(
          n => n.isDeleted === normalizeFlag(query.isDeleted),
        )
      }
      else {
        filtered = filtered.filter(n => n.isDeleted === 0)
      }

      if (query.folderId !== undefined) {
        filtered = filtered.filter(n => n.folderId === query.folderId)
      }

      if (query.isInbox !== undefined && query.isInbox) {
        filtered = filtered.filter(
          n => n.folderId === null && n.isDeleted === 0,
        )
      }

      if (query.isFavorites !== undefined && query.isFavorites) {
        filtered = filtered.filter(n => n.isFavorites === 1)
      }

      if (query.tagId !== undefined) {
        filtered = filtered.filter(n => n.tags.includes(query.tagId!))
      }

      if (query.search) {
        const matchedIds = getNoteIdsBySearchQuery(notes, query.search)
        filtered = filtered.filter(n => matchedIds.has(n.id))
      }

      const order = query.order === 'ASC' ? 1 : -1
      filtered.sort((a, b) => (a.updatedAt - b.updatedAt) * order)

      return filtered.map(n => createNoteRecord(n, state))
    },

    getNotesCounts(): NotesCount {
      const { notes } = getCache()
      const total = notes.filter(n => n.isDeleted === 0).length
      const trash = notes.filter(n => n.isDeleted === 1).length
      return { total, trash }
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

      if (
        input.name === undefined
        && input.description === undefined
        && input.folderId === undefined
        && input.isFavorites === undefined
        && input.isDeleted === undefined
      ) {
        return { invalidInput: true, notFound: false }
      }

      const previousFilePath = note.filePath
      let pathMayChange = false

      if (input.name !== undefined) {
        note.name = validateEntryName(input.name, 'note')
        pathMayChange = true
      }

      if (input.description !== undefined) {
        note.description = input.description ?? null
      }

      if (input.folderId !== undefined) {
        const nextFolderId = input.folderId ?? null

        if (
          nextFolderId !== null
          && !findNotesFolderById(state, nextFolderId)
        ) {
          throwStorageError('FOLDER_NOT_FOUND', 'Folder not found')
        }

        note.folderId = nextFolderId
        pathMayChange = true
      }

      if (input.isFavorites !== undefined) {
        note.isFavorites = normalizeFlag(input.isFavorites)
      }

      if (input.isDeleted !== undefined) {
        note.isDeleted = normalizeFlag(input.isDeleted)
        pathMayChange = true
      }

      note.updatedAt = Date.now()

      if (pathMayChange) {
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

      if (!note) {
        return { invalidInput: false, notFound: true }
      }

      note.content = content
      note.updatedAt = Date.now()
      writeNoteToFile(paths, note)
      invalidateNotesSearchIndex(state)

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

      if (!note || !tag) {
        return {
          noteFound: !!note,
          notFound: false,
          relationFound: false,
          tagFound: !!tag,
        }
      }

      const tagIndex = note.tags.indexOf(tagId)
      if (tagIndex === -1) {
        return {
          noteFound: true,
          notFound: false,
          relationFound: false,
          tagFound: true,
        }
      }

      note.tags.splice(tagIndex, 1)
      note.updatedAt = Date.now()
      writeNoteToFile(paths, note)

      return {
        noteFound: true,
        notFound: false,
        relationFound: true,
        tagFound: true,
      }
    },
  }
}
