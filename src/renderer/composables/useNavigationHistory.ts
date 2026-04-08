import { router, RouterName } from '@/router'
import { useNotes } from './spaces/notes/useNotes'
import {
  captureNavigationUIState,
  type NavigationHistoryUIState,
} from './useNavigationUIState'
import { useSnippets } from './useSnippets'

export interface NavigationHistoryRouteEntry {
  routeName: string
  type: 'route'
  uiState?: NavigationHistoryUIState
}

export interface NavigationHistoryEntityEntry {
  id: number
  name: string
  type: 'note' | 'snippet'
  uiState?: NavigationHistoryUIState
}

export type NavigationHistoryEntry =
  | NavigationHistoryRouteEntry
  | NavigationHistoryEntityEntry

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

  if (left.type === 'route' || right.type === 'route') {
    return (
      left.type === 'route'
      && right.type === 'route'
      && left.routeName === right.routeName
    )
  }

  return left.type === right.type && left.id === right.id
}

function captureCurrentLocation(): NavigationHistoryEntry | undefined {
  const routeName = router.currentRoute.value.name
  let entry: NavigationHistoryEntry | undefined

  if (routeName === RouterName.notesGraph) {
    entry = {
      routeName: RouterName.notesGraph,
      type: 'route',
    }
  }
  else if (routeName === RouterName.notesDashboard) {
    entry = {
      routeName: RouterName.notesDashboard,
      type: 'route',
    }
  }
  else if (
    (routeName === RouterName.notesSpace
      || routeName === RouterName.notesPresentation)
    && selectedNote.value
  ) {
    entry = {
      id: selectedNote.value.id,
      name: selectedNote.value.name,
      type: 'note',
    }
  }
  else if (routeName === RouterName.main && selectedSnippet.value) {
    entry = {
      id: selectedSnippet.value.id,
      name: selectedSnippet.value.name,
      type: 'snippet',
    }
  }

  if (!entry) {
    return
  }

  const uiState = captureNavigationUIState(entry)

  if (!uiState) {
    return entry
  }

  return {
    ...entry,
    uiState,
  }
}

function trimEntries(nextEntries: NavigationHistoryEntry[]) {
  if (nextEntries.length <= MAX_HISTORY_SIZE) {
    return nextEntries
  }

  return nextEntries.slice(nextEntries.length - MAX_HISTORY_SIZE)
}

function pushOrReplaceEntry(
  nextEntries: NavigationHistoryEntry[],
  entry: NavigationHistoryEntry,
) {
  if (isSameEntry(nextEntries.at(-1), entry)) {
    nextEntries[nextEntries.length - 1] = entry
    return
  }

  nextEntries.push(entry)
}

function syncCurrentEntryWithLocation() {
  if (cursor.value < 0) {
    return
  }

  const current = captureCurrentLocation()

  if (!current || !isSameEntry(entries.value[cursor.value], current)) {
    return
  }

  entries.value[cursor.value] = current
}

async function recordNavigation(navigate: () => Promise<void>) {
  const before = captureCurrentLocation()

  await navigate()

  const after = captureCurrentLocation()

  if (!before && !after) {
    return
  }

  const nextEntries = entries.value.slice(0, Math.max(cursor.value + 1, 0))

  if (before) {
    pushOrReplaceEntry(nextEntries, before)
  }

  if (after) {
    pushOrReplaceEntry(nextEntries, after)
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

  syncCurrentEntryWithLocation()
  cursor.value -= 1
  return entries.value[cursor.value]
}

function goForward(): NavigationHistoryEntry | undefined {
  if (!canGoForward.value) {
    return
  }

  syncCurrentEntryWithLocation()
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
