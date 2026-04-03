import type { LibraryFilter } from '../../types'
import { store } from '@/electron'
import {
  getLayoutModeFromNotesPanels,
  getNextLayoutModeForSidebarToggle,
  type LayoutMode,
} from '../../layoutModes'

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
  (store.app.get('notes.selection') as NotesSavedState) || {},
)

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedNoteIds = ref<Set<number>>(new Set())
const highlightedTagId = ref<number>()
const focusedFolderId = ref<number | undefined>()
const focusedNoteId = ref<number | undefined>()

export type NotesEditorMode = 'raw' | 'livePreview' | 'preview'

const notesEditorMode = ref<NotesEditorMode>(
  (store.app.get('notes.editorMode') as NotesEditorMode) || 'livePreview',
)

watch(notesEditorMode, (mode) => {
  store.app.set('notes.editorMode', mode)
})

const isNotesSpaceInitialized = ref(false)
const pendingNotesNavigation = ref(false)
const isFocusedNoteName = ref(false)
const isFocusedSearch = ref(false)
const isNotesMindmapShown = ref(false)
const isNotesPresentationShown = ref(false)
const notesLayoutMode = ref<LayoutMode>(
  (store.app.get('notes.layout.mode') as LayoutMode)
  || getLayoutModeFromNotesPanels({
    isSidebarHidden: false,
    isListHidden: false,
  }),
)
const isNotesSidebarHidden = computed({
  get: () => notesLayoutMode.value !== 'all-panels',
  set: (value: boolean) => {
    notesLayoutMode.value = value ? 'list-editor' : 'all-panels'
  },
})
const isNotesListHidden = computed({
  get: () => notesLayoutMode.value === 'editor-only',
  set: (value: boolean) => {
    notesLayoutMode.value = value ? 'editor-only' : 'list-editor'
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
  notesLayoutMode.value = 'all-panels'
}

function hideNotesSidebar() {
  notesLayoutMode.value = 'list-editor'
}

function showNotesEditorOnly() {
  notesLayoutMode.value = 'editor-only'
}

function setNotesLayoutMode(value: LayoutMode) {
  notesLayoutMode.value = value
}

function toggleNotesSidebar() {
  notesLayoutMode.value = getNextLayoutModeForSidebarToggle(
    notesLayoutMode.value,
  )
}

function hideNotesViewModes() {
  isNotesMindmapShown.value = false
  isNotesPresentationShown.value = false
}

function showNotesMindmap() {
  isNotesMindmapShown.value = true
  isNotesPresentationShown.value = false
}

function showNotesPresentation() {
  isNotesPresentationShown.value = true
  isNotesMindmapShown.value = false
}

watch(
  notesState,
  () => {
    store.app.set('notes.selection', JSON.parse(JSON.stringify(notesState)))
  },
  { deep: true },
)

watch(notesLayoutMode, (mode) => {
  store.app.set('notes.layout.mode', mode)
})

export function useNotesApp() {
  return {
    focusedFolderId,
    focusedNoteId,
    highlightedFolderIds,
    highlightedNoteIds,
    highlightedTagId,
    isFocusedNoteName,
    isFocusedSearch,
    isNotesMindmapShown,
    isNotesListHidden,
    notesLayoutMode,
    isNotesPresentationShown,
    notesEditorMode,
    isNotesSidebarHidden,
    isNotesSpaceInitialized,
    pendingNotesNavigation,
    hideNotesSidebar,
    hideNotesViewModes,
    notesState,
    restoreNotesStateSnapshot,
    saveNotesStateSnapshot,
    setNotesLayoutMode,
    showAllNotesPanels,
    showNotesMindmap,
    showNotesPresentation,
    showNotesEditorOnly,
    stateSnapshots,
    toggleNotesSidebar,
  }
}
