import type { LibraryFilter } from '../../types'
import { store } from '@/electron'

export type NotesStateAction = 'beforeSearch'

export interface NotesSavedState {
  noteId?: number
  folderId?: number
  tagId?: number
  libraryFilter?: (typeof LibraryFilter)[keyof typeof LibraryFilter]
  isSidebarHidden?: boolean
  isListHidden?: boolean
}

const stateSnapshots = reactive<Record<NotesStateAction, NotesSavedState>>({
  beforeSearch: {},
})

const notesState = reactive<NotesSavedState>(
  (store.app.get('notesState') as NotesSavedState) || {},
)

if (notesState.isSidebarHidden === undefined) {
  notesState.isSidebarHidden = false
}

if (notesState.isListHidden === undefined) {
  notesState.isListHidden = false
}

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedNoteIds = ref<Set<number>>(new Set())
const highlightedTagId = ref<number>()
const focusedFolderId = ref<number | undefined>()
const focusedNoteId = ref<number | undefined>()

const isNotesSpaceInitialized = ref(false)
const isFocusedNoteName = ref(false)
const isFocusedSearch = ref(false)
const isNotesSidebarHidden = computed({
  get: () => Boolean(notesState.isSidebarHidden),
  set: (value: boolean) => {
    notesState.isSidebarHidden = value

    if (!value) {
      notesState.isListHidden = false
    }
  },
})
const isNotesListHidden = computed({
  get: () => Boolean(notesState.isListHidden),
  set: (value: boolean) => {
    notesState.isListHidden = value

    if (value) {
      notesState.isSidebarHidden = true
    }
  },
})

function saveNotesStateSnapshot(action: NotesStateAction): void {
  stateSnapshots[action] = {
    noteId: notesState.noteId,
    folderId: notesState.folderId,
    tagId: notesState.tagId,
    isListHidden: isNotesListHidden.value,
    isSidebarHidden: isNotesSidebarHidden.value,
    libraryFilter: notesState.libraryFilter,
  }
}

function restoreNotesStateSnapshot(action: NotesStateAction): void {
  const snapshot = stateSnapshots[action]

  if (!snapshot)
    return

  if (snapshot.noteId !== undefined)
    notesState.noteId = snapshot.noteId
  if (snapshot.folderId !== undefined)
    notesState.folderId = snapshot.folderId
  if (snapshot.tagId !== undefined)
    notesState.tagId = snapshot.tagId
  if (snapshot.libraryFilter !== undefined)
    notesState.libraryFilter = snapshot.libraryFilter
  if (snapshot.isSidebarHidden !== undefined) {
    isNotesSidebarHidden.value = snapshot.isSidebarHidden
  }
  if (snapshot.isListHidden !== undefined) {
    isNotesListHidden.value = snapshot.isListHidden
  }
}

function showAllNotesPanels() {
  isNotesSidebarHidden.value = false
  isNotesListHidden.value = false
}

function hideNotesSidebar() {
  isNotesSidebarHidden.value = true
  isNotesListHidden.value = false
}

function showNotesEditorOnly() {
  isNotesSidebarHidden.value = true
  isNotesListHidden.value = true
}

watch(
  notesState,
  () => {
    store.app.set('notesState', JSON.parse(JSON.stringify(notesState)))
  },
  { deep: true },
)

export function useNotesApp() {
  return {
    focusedFolderId,
    focusedNoteId,
    highlightedFolderIds,
    highlightedNoteIds,
    highlightedTagId,
    isFocusedNoteName,
    isFocusedSearch,
    isNotesListHidden,
    isNotesSidebarHidden,
    isNotesSpaceInitialized,
    hideNotesSidebar,
    notesState,
    restoreNotesStateSnapshot,
    saveNotesStateSnapshot,
    showAllNotesPanels,
    showNotesEditorOnly,
    stateSnapshots,
  }
}
