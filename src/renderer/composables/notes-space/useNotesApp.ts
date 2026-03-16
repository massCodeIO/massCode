import type { LibraryFilter } from '../types'
import { store } from '@/electron'

export type NotesStateAction = 'beforeSearch'

export interface NotesSavedState {
  noteId?: number
  folderId?: number
  tagId?: number
  libraryFilter?: (typeof LibraryFilter)[keyof typeof LibraryFilter]
}

const stateSnapshots = reactive<Record<NotesStateAction, NotesSavedState>>({
  beforeSearch: {},
})

const notesState = reactive<NotesSavedState>(
  (store.app.get('notesState') as NotesSavedState) || {},
)

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedNoteIds = ref<Set<number>>(new Set())
const highlightedTagId = ref<number>()
const focusedFolderId = ref<number | undefined>()
const focusedNoteId = ref<number | undefined>()

const isNotesSpaceInitialized = ref(false)
const isFocusedNoteName = ref(false)
const isFocusedSearch = ref(false)

function saveNotesStateSnapshot(action: NotesStateAction): void {
  stateSnapshots[action] = {
    noteId: notesState.noteId,
    folderId: notesState.folderId,
    tagId: notesState.tagId,
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
    isNotesSpaceInitialized,
    notesState,
    restoreNotesStateSnapshot,
    saveNotesStateSnapshot,
    stateSnapshots,
  }
}
