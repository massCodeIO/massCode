import { router, RouterName } from '@/router'
import { useNotes } from './spaces/notes/useNotes'
import { useSnippets } from './useSnippets'

export interface NavigationHistoryEntry {
  id: number
  name: string
  type: 'note' | 'snippet'
}

export const MAX_HISTORY_SIZE = 50

const entries = ref<NavigationHistoryEntry[]>([])
const cursor = ref(-1)
const isNavigatingHistory = ref(false)

const { selectedNote } = useNotes()
const { selectedSnippet } = useSnippets()

const canGoBack = computed(() => cursor.value > 0)
const canGoForward = computed(
  () => cursor.value >= 0 && cursor.value < entries.value.length - 1,
)

function isSameEntry(
  left?: NavigationHistoryEntry,
  right?: NavigationHistoryEntry,
): boolean {
  if (!left || !right) {
    return false
  }

  return left.type === right.type && left.id === right.id
}

function captureCurrentLocation(): NavigationHistoryEntry | undefined {
  const routeName = router.currentRoute.value.name

  if (
    (routeName === RouterName.notesSpace
      || routeName === RouterName.notesPresentation)
    && selectedNote.value
  ) {
    return {
      id: selectedNote.value.id,
      name: selectedNote.value.name,
      type: 'note',
    }
  }

  if (routeName === RouterName.main && selectedSnippet.value) {
    return {
      id: selectedSnippet.value.id,
      name: selectedSnippet.value.name,
      type: 'snippet',
    }
  }
}

function trimEntries(nextEntries: NavigationHistoryEntry[]) {
  if (nextEntries.length <= MAX_HISTORY_SIZE) {
    return nextEntries
  }

  return nextEntries.slice(nextEntries.length - MAX_HISTORY_SIZE)
}

async function recordNavigation(navigate: () => Promise<void>) {
  const before = captureCurrentLocation()

  await navigate()

  const after = captureCurrentLocation()

  if (!before && !after) {
    return
  }

  const nextEntries = entries.value.slice(0, Math.max(cursor.value + 1, 0))

  if (before && !isSameEntry(nextEntries.at(-1), before)) {
    nextEntries.push(before)
  }

  if (after && !isSameEntry(nextEntries.at(-1), after)) {
    nextEntries.push(after)
  }

  if (!nextEntries.length) {
    return
  }

  entries.value = trimEntries(nextEntries)
  cursor.value = entries.value.length - 1
}

function goBack(): NavigationHistoryEntry | undefined {
  if (!canGoBack.value) {
    return
  }

  cursor.value -= 1
  return entries.value[cursor.value]
}

function goForward(): NavigationHistoryEntry | undefined {
  if (!canGoForward.value) {
    return
  }

  cursor.value += 1
  return entries.value[cursor.value]
}

function clearHistory() {
  entries.value = []
  cursor.value = -1
}

export function useNavigationHistory() {
  return {
    canGoBack,
    canGoForward,
    clearHistory,
    cursor,
    entries,
    goBack,
    goForward,
    isNavigatingHistory,
    recordNavigation,
  }
}
