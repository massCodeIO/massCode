import { router, RouterName } from '@/router'
import { useDrawings } from './spaces/drawings/useDrawings'
import { useHttpApp } from './spaces/http/useHttpApp'
import { useHttpFolders } from './spaces/http/useHttpFolders'
import { useHttpRequests } from './spaces/http/useHttpRequests'
import { useNotes } from './spaces/notes/useNotes'
import {
  captureNavigationUIState,
  clearPendingNavigationUIStateRestore,
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
  type: 'note' | 'snippet' | 'http-request' | 'http-folder'
  uiState?: NavigationHistoryUIState
}

export interface NavigationHistoryDrawingEntry {
  id: string
  name: string
  type: 'drawing'
  uiState?: NavigationHistoryUIState
}

export type NavigationHistoryEntry =
  | NavigationHistoryRouteEntry
  | NavigationHistoryEntityEntry
  | NavigationHistoryDrawingEntry

export const MAX_HISTORY_SIZE = 50

const entries = ref<NavigationHistoryEntry[]>([])
const cursor = ref(-1)
const isNavigatingHistory = ref(false)
let revision = 0

const { selectedNote } = useNotes()
const { selectedSnippet } = useSnippets()
const { currentRequest } = useHttpRequests()
const { httpState } = useHttpApp()
const { folders, getFolderByIdFromTree } = useHttpFolders()
const { activeDrawing } = useDrawings()

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
  else if (
    routeName === RouterName.httpSpace
    && httpState.activePanel === 'folder'
  ) {
    const folder = getFolderByIdFromTree(
      folders.value,
      httpState.folderId ?? null,
    )
    if (folder)
      entry = { id: folder.id, name: folder.name, type: 'http-folder' }
  }
  else if (routeName === RouterName.httpSpace && currentRequest.value) {
    entry = {
      id: currentRequest.value.id,
      name: currentRequest.value.name,
      type: 'http-request',
    }
  }
  else if (routeName === RouterName.drawingsSpace && activeDrawing.value) {
    entry = {
      id: activeDrawing.value.id,
      name: activeDrawing.value.name,
      type: 'drawing',
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

let pendingNavigation: Promise<void> | undefined

// Keep synchronous selections immediate; serialize only while an async open
// is running so replay cannot be overtaken by its late state mutations.
function runNavigation(operation: () => void | Promise<void>) {
  const result = pendingNavigation
    ? pendingNavigation.then(operation)
    : operation()
  if (result instanceof Promise) {
    let settled: Promise<void>
    const tracked = result.finally(() => {
      if (pendingNavigation === settled)
        pendingNavigation = undefined
    })
    settled = tracked.then(
      () => {},
      () => {},
    )
    pendingNavigation = settled
    return tracked
  }
}

function recordNavigation(
  navigate: () => void | boolean | Promise<void | boolean>,
) {
  if (isNavigatingHistory.value)
    return
  return runNavigation(() => recordNavigationInternal(navigate))
}

function recordNavigationInternal(
  navigate: () => void | boolean | Promise<void | boolean>,
) {
  clearPendingNavigationUIStateRestore()
  const intent = ++revision
  const before = captureCurrentLocation()
  const commit = (result: void | boolean) => {
    if (result === false || intent !== revision)
      return
    const after = captureCurrentLocation()
    if ((!before && !after) || isSameEntry(before, after)) {
      if (!entries.value.length && after) {
        entries.value = [after]
        cursor.value = 0
      }
      else {
        syncCurrentEntryWithLocation()
      }
      return
    }
    const nextEntries = entries.value.slice(0, Math.max(cursor.value + 1, 0))
    if (before)
      pushOrReplaceEntry(nextEntries, before)
    if (after)
      pushOrReplaceEntry(nextEntries, after)
    entries.value = trimEntries(nextEntries)
    cursor.value = entries.value.length - 1
  }
  const result = navigate()
  if (result instanceof Promise)
    return result.then(commit)
  commit(result)
}

async function restoreHistory(
  direction: -1 | 1,
  restore: (
    entry: NavigationHistoryEntry,
  ) => Promise<'restored' | 'missing' | 'cancelled'>,
) {
  if (isNavigatingHistory.value)
    return
  isNavigatingHistory.value = true
  try {
    await runNavigation(() => restoreHistoryInternal(direction, restore))
  }
  finally {
    isNavigatingHistory.value = false
  }
}

async function restoreHistoryInternal(
  direction: -1 | 1,
  restore: (
    entry: NavigationHistoryEntry,
  ) => Promise<'restored' | 'missing' | 'cancelled'>,
) {
  clearPendingNavigationUIStateRestore()
  const intent = ++revision
  syncCurrentEntryWithLocation()
  let index = cursor.value + direction
  while (index >= 0 && index < entries.value.length) {
    const result = await restore(entries.value[index]!)
    if (intent !== revision || result === 'cancelled')
      return
    if (result === 'restored') {
      cursor.value = index
      return
    }
    entries.value.splice(index, 1)
    if (index < cursor.value)
      cursor.value -= 1
    if (direction === -1)
      index -= 1
  }
}

function goBack(): NavigationHistoryEntry | undefined {
  if (!canGoBack.value) {
    return
  }

  revision += 1
  syncCurrentEntryWithLocation()
  cursor.value -= 1
  return entries.value[cursor.value]
}

function goForward(): NavigationHistoryEntry | undefined {
  if (!canGoForward.value) {
    return
  }

  revision += 1
  syncCurrentEntryWithLocation()
  cursor.value += 1
  return entries.value[cursor.value]
}

function clearHistory() {
  clearPendingNavigationUIStateRestore()
  revision += 1
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
    restoreHistory,
  }
}
