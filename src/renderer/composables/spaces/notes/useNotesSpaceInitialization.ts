import { useNoteFolders } from './useNoteFolders'
import { useNotes } from './useNotes'
import { useNotesApp } from './useNotesApp'
import { useNoteSearch } from './useNoteSearch'
import { useNoteTags } from './useNoteTags'

const {
  hideNotesViewModes,
  isNotesSpaceInitialized,
  notesState,
  pendingNotesNavigation,
  showAllNotesPanels,
} = useNotesApp()
const { getNoteFolders } = useNoteFolders()
const { getNotes, selectFirstNote } = useNotes()
const { displayedNotes } = useNoteSearch()
const { getNoteTags } = useNoteTags()

export function resetNotesSpaceInitialization() {
  isNotesSpaceInitialized.value = false
}

function hasSelectedNoteInList(noteId: number | undefined): boolean {
  if (noteId === undefined || !displayedNotes.value?.length) {
    return false
  }

  return displayedNotes.value.some(note => note.id === noteId)
}

async function initNotesSpace() {
  if (isNotesSpaceInitialized.value || pendingNotesNavigation.value) {
    return
  }

  const results = await Promise.allSettled([
    getNoteFolders(),
    getNotes(),
    getNoteTags(),
  ])

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Notes init error:', result.reason)
    }
  })

  isNotesSpaceInitialized.value = results.every(
    result => result.status === 'fulfilled',
  )

  if (
    !hasSelectedNoteInList(notesState.noteId)
    && displayedNotes.value?.length
  ) {
    selectFirstNote()
  }

  if (!hasSelectedNoteInList(notesState.noteId)) {
    hideNotesViewModes()
    showAllNotesPanels()
  }
}

export function useNotesSpaceInitialization() {
  return {
    initNotesSpace,
  }
}
