import {
  getNotes,
  isRestoreStateBlocked,
  notes,
  selectFirstNote,
  selectNote,
} from './useNotes'
import { useNotesApp } from './useNotesApp'

const { saveNotesStateSnapshot, restoreNotesStateSnapshot, stateSnapshots }
  = useNotesApp()

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

async function search(current: () => boolean = () => true) {
  if (searchQuery.value) {
    if (!isSearch.value) {
      saveNotesStateSnapshot('beforeSearch')
    }

    isSearch.value = true
    isRestoreStateBlocked.value = false

    if (!(await getNotes()) || !current())
      return false
    await selectFirstNote()
    searchSelectedIndex.value = 0
  }
  else {
    isSearch.value = false
  }
  return true
}

async function selectSearchNote(index: number) {
  if (
    !displayedNotes.value
    || index < 0
    || index >= displayedNotes.value.length
  ) {
    return
  }

  const note = displayedNotes.value[index]
  searchSelectedIndex.value = index
  const { useNavigationHistory } = await import(
    '@/composables/useNavigationHistory'
  )
  await useNavigationHistory().recordNavigation(() => selectNote(note.id))
}

function clearSearch(restoreState = false) {
  if (restoreState && !isRestoreStateBlocked.value) {
    restoreNotesStateSnapshot('beforeSearch')
  }

  searchQuery.value = ''
  isSearch.value = false
  searchSelectedIndex.value = -1
}

function resetNoteSearchState() {
  clearSearch()
  notesBySearch.value = undefined
  stateSnapshots.beforeSearch = {}
  isRestoreStateBlocked.value = false
}

export function useNoteSearch() {
  return {
    clearSearch,
    displayedNotes,
    isSearch,
    resetNoteSearchState,
    search,
    searchQuery,
    searchSelectedIndex,
    selectSearchNote,
  }
}
