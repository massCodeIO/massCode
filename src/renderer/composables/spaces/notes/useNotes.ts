import { useDialog } from '@/composables/useDialog'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { getContiguousSelection } from '@/utils'
import { api } from '~/renderer/services/api'
import { LibraryFilter } from '../../types'
import { useNotesApp } from './useNotesApp'

const {
  notesState,
  saveNotesStateSnapshot,
  restoreNotesStateSnapshot,
  isFocusedNoteName,
} = useNotesApp()

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

const selectedNoteIds = ref<number[]>(
  notesState.noteId ? [notesState.noteId] : [],
)
const lastSelectedNoteId = ref<number | undefined>()

const notes = shallowRef<NotesResponse>()
const notesBySearch = shallowRef<NotesResponse>()

const searchQuery = ref('')
const isSearch = ref(false)
const isRestoreStateBlocked = ref(false)
const searchSelectedIndex = ref<number>(-1)
const notesLoadingCounter = ref(0)
const isNotesLoadingVisible = ref(false)
const contentUpdateQueue = ref<Map<number, string>>(new Map())
const contentUpdateTimers = ref<Map<number, ReturnType<typeof setTimeout>>>(
  new Map(),
)
const inFlightContentUpdateIds = ref<Set<number>>(new Set())

const CONTENT_UPDATE_DEBOUNCE_MS = 500
const NOTES_LOADING_VISIBILITY_DELAY_MS = 300
let notesLoadingVisibilityTimer: ReturnType<typeof setTimeout> | undefined

// --- Computed ---

const displayedNotes = computed(() => {
  if (isSearch.value) {
    return notesBySearch.value
  }

  return notes.value
})

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

function updateLocalNoteContent(noteId: number, content: string) {
  const now = Date.now()

  function updateCollection(collection?: NotesResponse) {
    const note = collection?.find(item => item.id === noteId)
    if (note) {
      note.content = content
      note.updatedAt = now
    }
  }

  updateCollection(notes.value)
  updateCollection(notesBySearch.value)
}

function scheduleContentUpdate(noteId: number) {
  const currentTimer = contentUpdateTimers.value.get(noteId)
  if (currentTimer) {
    clearTimeout(currentTimer)
  }

  const timer = setTimeout(() => {
    contentUpdateTimers.value.delete(noteId)
    void flushContentUpdate(noteId)
  }, CONTENT_UPDATE_DEBOUNCE_MS)

  contentUpdateTimers.value.set(noteId, timer)
}

async function flushContentUpdate(noteId: number) {
  const content = contentUpdateQueue.value.get(noteId)
  if (content === undefined) {
    return
  }

  contentUpdateQueue.value.delete(noteId)
  inFlightContentUpdateIds.value.add(noteId)

  try {
    markPersistedStorageMutation()
    await api.notes.patchNotesByIdContent(String(noteId), { content })
  }
  catch (error) {
    console.error(error)
  }
  finally {
    inFlightContentUpdateIds.value.delete(noteId)

    if (contentUpdateQueue.value.has(noteId)) {
      scheduleContentUpdate(noteId)
    }
  }
}

function hasBusyNoteContentUpdates() {
  return (
    contentUpdateQueue.value.size > 0 || inFlightContentUpdateIds.value.size > 0
  )
}

// --- CRUD ---

async function getNotes(query?: NotesQuery) {
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

function updateNoteContent(noteId: number, content: string) {
  updateLocalNoteContent(noteId, content)
  contentUpdateQueue.value.set(noteId, content)

  if (inFlightContentUpdateIds.value.has(noteId)) {
    return
  }

  scheduleContentUpdate(noteId)
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

function selectNote(noteId: number, withShift = false) {
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

function selectFirstNote() {
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

// --- Search ---

async function search() {
  if (searchQuery.value) {
    if (!isSearch.value) {
      saveNotesStateSnapshot('beforeSearch')
    }

    isSearch.value = true
    isRestoreStateBlocked.value = false

    await getNotes({ search: searchQuery.value })
    selectFirstNote()
    searchSelectedIndex.value = 0
  }
  else {
    isSearch.value = false
  }
}

function selectSearchNote(index: number) {
  if (
    !displayedNotes.value
    || index < 0
    || index >= displayedNotes.value.length
  ) {
    return
  }

  const note = displayedNotes.value[index]
  selectNote(note.id)
  searchSelectedIndex.value = index
}

function clearSearch(restoreState = false) {
  if (restoreState && !isRestoreStateBlocked.value) {
    restoreNotesStateSnapshot('beforeSearch')
  }

  searchQuery.value = ''
  isSearch.value = false
  searchSelectedIndex.value = -1
}

export function useNotes() {
  return {
    addTagToNote,
    clearNotes,
    clearNotesState,
    clearSearch,
    createNote,
    createNoteAndSelect,
    deleteNote,
    deleteNotes,
    deleteTagFromNote,
    displayedNotes,
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
    search,
    searchQuery,
    searchSelectedIndex,
    selectedNote,
    selectedNoteIds,
    selectedNotes,
    selectFirstNote,
    selectNote,
    selectSearchNote,
    updateNote,
    updateNotes,
    updateNoteContent,
    withNotesLoading,
  }
}
