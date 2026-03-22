import {
  getNotes,
  isRestoreStateBlocked,
  notes,
  selectFirstNote,
  selectNote,
} from './useNotes'
import { useNotesApp } from './useNotesApp'

const { saveNotesStateSnapshot, restoreNotesStateSnapshot } = useNotesApp()

// --- Module-level state ---

export const notesBySearch = shallowRef<any[]>()
export const isSearch = ref(false)
export const searchQuery = ref('')
const searchSelectedIndex = ref<number>(-1)

// --- Computed ---

const displayedNotes = computed(() => {
  if (isSearch.value) {
    return notesBySearch.value
  }

  return notes.value
})

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

export function useNoteSearch() {
  return {
    clearSearch,
    displayedNotes,
    isSearch,
    search,
    searchQuery,
    searchSelectedIndex,
    selectSearchNote,
  }
}
