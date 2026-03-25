import { useDialog } from '@/composables/useDialog'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { getContiguousSelection } from '@/utils'
import { api } from '~/renderer/services/api'
import { LibraryFilter } from '../../types'
import { useNoteContent } from './useNoteContent'
import { useNotesApp } from './useNotesApp'
import { isSearch, notesBySearch, searchQuery } from './useNoteSearch'

const { notesState, isFocusedNoteName } = useNotesApp()

// --- Types ---
// These mirror the generated API types that will exist after api:generate.

interface NoteTagInfo {
  id: number
  name: string
}

interface NoteFolderInfo {
  id: number
  name: string
}

interface NoteRecord {
  id: number
  name: string
  description: string | null
  content: string
  tags: NoteTagInfo[]
  folder: NoteFolderInfo | null
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

type NotesResponse = NoteRecord[]

interface NotesQuery {
  search?: string
  sort?: string
  order?: 'ASC' | 'DESC'
  folderId?: number
  tagId?: number
  isFavorites?: number
  isDeleted?: number
  isInbox?: number
}

interface NotesUpdate {
  name?: string
  folderId?: number | null
  description?: string | null
  isDeleted?: number
  isFavorites?: number
}

// --- Module-level state ---

export const selectedNoteIds = ref<number[]>(
  notesState.noteId ? [notesState.noteId] : [],
)
const lastSelectedNoteId = ref<number | undefined>()

export const notes = shallowRef<NotesResponse>()

export const isRestoreStateBlocked = ref(false)
const notesLoadingCounter = ref(0)
const isNotesLoadingVisible = ref(false)
const NOTES_LOADING_VISIBILITY_DELAY_MS = 300
let notesLoadingVisibilityTimer: ReturnType<typeof setTimeout> | undefined

// --- Computed ---

const selectedNote = computed(() => {
  if (isSearch.value) {
    return notesBySearch.value?.find(n => n.id === notesState.noteId)
  }

  return notes.value?.find(n => n.id === notesState.noteId)
})

const selectedNotes = computed(() => {
  const source = isSearch.value ? notesBySearch.value : notes.value
  return source?.filter(n => selectedNoteIds.value.includes(n.id)) || []
})

const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: NotesQuery = {}

  if (isSearch.value) {
    query.search = searchQuery.value
    return query
  }

  if (notesState.tagId) {
    query.tagId = notesState.tagId
    return query
  }

  if (notesState.folderId) {
    query.folderId = notesState.folderId
  }
  else if (notesState.libraryFilter === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (notesState.libraryFilter === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (notesState.libraryFilter === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (notesState.libraryFilter === LibraryFilter.Inbox) {
    query.isInbox = 1
  }

  return query
})

const isEmpty = computed(() => {
  if (isSearch.value) {
    return notesBySearch.value?.length === 0
  }

  return notes.value?.length === 0
})

const isNotesLoading = computed(() => notesLoadingCounter.value > 0)

function clearNotesLoadingVisibilityTimer() {
  if (!notesLoadingVisibilityTimer) {
    return
  }

  clearTimeout(notesLoadingVisibilityTimer)
  notesLoadingVisibilityTimer = undefined
}

watch(
  isNotesLoading,
  (loading) => {
    if (loading) {
      if (isNotesLoadingVisible.value || notesLoadingVisibilityTimer) {
        return
      }

      notesLoadingVisibilityTimer = setTimeout(() => {
        notesLoadingVisibilityTimer = undefined

        if (notesLoadingCounter.value > 0) {
          isNotesLoadingVisible.value = true
        }
      }, NOTES_LOADING_VISIBILITY_DELAY_MS)

      return
    }

    clearNotesLoadingVisibilityTimer()
    isNotesLoadingVisible.value = false
  },
  { immediate: true },
)

// --- Utility ---

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNextIndexedName(baseName: string, existingNames: string[]): string {
  const normalizedBase = baseName.trim()
  const indexedNameRe = new RegExp(
    `^${escapeRegExp(normalizedBase)}(?:\\s+(\\d+))?$`,
    'i',
  )

  let maxIndex = 0

  existingNames.forEach((name) => {
    const match = name.trim().match(indexedNameRe)
    if (!match) {
      return
    }

    const index = match[1] ? Number(match[1]) : 0
    if (Number.isFinite(index)) {
      maxIndex = Math.max(maxIndex, index)
    }
  })

  return `${normalizedBase} ${maxIndex + 1}`
}

async function getNoteNamesForCreate(
  folderId: number | null,
): Promise<string[]> {
  const query: NotesQuery
    = folderId !== null
      ? { folderId, isDeleted: 0 }
      : { isInbox: 1, isDeleted: 0 }
  const { data } = await api.notes.getNotes(query)

  return data.map((note: NoteRecord) => note.name)
}

// --- CRUD ---

export async function getNotes(query?: NotesQuery) {
  return withNotesLoading(async () => {
    const { data } = await api.notes.getNotes(
      query || queryByLibraryOrFolderOrSearch.value,
    )

    if (isSearch.value) {
      notesBySearch.value = data
    }
    else {
      notes.value = data
    }
  })
}

async function withNotesLoading<T>(loader: () => Promise<T>): Promise<T> {
  notesLoadingCounter.value += 1

  try {
    return await loader()
  }
  finally {
    notesLoadingCounter.value = Math.max(0, notesLoadingCounter.value - 1)
  }
}

async function createNote() {
  try {
    const targetFolderId = notesState.folderId || null
    const existingNames = await getNoteNamesForCreate(targetFolderId)
    const nextNoteName = getNextIndexedName(
      i18n.t('notes.untitled'),
      existingNames,
    )

    markPersistedStorageMutation()
    await api.notes.postNotes({
      name: nextNoteName,
      folderId: targetFolderId,
    })

    if (
      notesState.libraryFilter === LibraryFilter.Trash
      || notesState.libraryFilter === LibraryFilter.Favorites
    ) {
      notesState.libraryFilter = LibraryFilter.All
    }

    await getNotes(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

async function createNoteAndSelect() {
  await createNote()
  selectFirstNote()
  isFocusedNoteName.value = true
}

async function updateNote(noteId: number, data: NotesUpdate) {
  markPersistedStorageMutation()
  await api.notes.patchNotesById(String(noteId), data)
  await getNotes(queryByLibraryOrFolderOrSearch.value)
}

async function updateNotes(noteIds: number[], data: NotesUpdate[]) {
  markPersistedStorageMutation()

  for (const [index, noteId] of noteIds.entries()) {
    await api.notes.patchNotesById(String(noteId), data[index])
  }

  await getNotes(queryByLibraryOrFolderOrSearch.value)
}

async function deleteNote(noteId: number) {
  markPersistedStorageMutation()
  await api.notes.deleteNotesById(String(noteId))
  await getNotes(queryByLibraryOrFolderOrSearch.value)
}

async function deleteNotes(noteIds: number[]) {
  markPersistedStorageMutation()

  for (const noteId of noteIds) {
    await api.notes.deleteNotesById(String(noteId))
  }
  await getNotes(queryByLibraryOrFolderOrSearch.value)
}

async function emptyTrash() {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.emptyTrash'),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (isConfirmed) {
    await api.notes.deleteNotesTrash()
    await getNotes(queryByLibraryOrFolderOrSearch.value)
  }
}

// --- Tag operations ---

async function addTagToNote(tagId: number, noteId: number) {
  try {
    await api.notes.postNotesByIdTagsByTagId(String(noteId), String(tagId))
    await getNotes(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteTagFromNote(tagId: number, noteId: number) {
  try {
    await api.notes.deleteNotesByIdTagsByTagId(String(noteId), String(tagId))
    await getNotes(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

// --- Selection ---

export function selectNote(noteId: number, withShift = false) {
  if (!withShift) {
    selectedNoteIds.value = [noteId]
    notesState.noteId = noteId
    return
  }

  if (notesState.noteId !== undefined) {
    const source = isSearch.value ? notesBySearch.value : notes.value

    if (source?.length) {
      const orderedIds = source.map(note => note.id)
      const rangeSelection = getContiguousSelection(
        orderedIds,
        notesState.noteId,
        noteId,
      )

      if (rangeSelection.length) {
        selectedNoteIds.value = rangeSelection
        lastSelectedNoteId.value = noteId
      }
    }
  }
  else {
    selectedNoteIds.value = [noteId]
    lastSelectedNoteId.value = noteId
    notesState.noteId = noteId
  }
}

export function selectFirstNote() {
  let firstNote: NoteRecord | undefined

  if (isSearch.value) {
    firstNote = notesBySearch.value?.[0]
  }
  else {
    firstNote = notes.value?.[0]
  }

  if (firstNote) {
    notesState.noteId = firstNote.id
    selectedNoteIds.value = [firstNote.id]
    lastSelectedNoteId.value = firstNote.id
  }
  else {
    notesState.noteId = undefined
    selectedNoteIds.value = []
    lastSelectedNoteId.value = undefined
  }
}

function clearNotes() {
  notes.value = []
  notesBySearch.value = []
}

function clearNotesState() {
  clearNotes()
  selectedNoteIds.value = []
  notesState.noteId = undefined
}

export function useNotes() {
  const { hasBusyNoteContentUpdates, updateNoteContent } = useNoteContent()

  return {
    addTagToNote,
    clearNotes,
    clearNotesState,
    createNote,
    createNoteAndSelect,
    deleteNote,
    deleteNotes,
    deleteTagFromNote,
    emptyTrash,
    getNotes,
    hasBusyNoteContentUpdates,
    isEmpty,
    isNotesLoading,
    isNotesLoadingVisible,
    isRestoreStateBlocked,
    isSearch,
    lastSelectedNoteId,
    notes,
    selectedNote,
    selectedNoteIds,
    selectedNotes,
    selectFirstNote,
    selectNote,
    updateNote,
    updateNotes,
    updateNoteContent,
    withNotesLoading,
  }
}
