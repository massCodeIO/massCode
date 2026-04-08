import type { NavigationHistoryEntry } from './useNavigationHistory'

export interface NavigationHistoryUIState {
  scrollTop: number
}

interface NavigationUIStateController {
  getScrollTop: () => number
  setScrollTop: (scrollTop: number) => void
}

const noteControllers = new Map<number, NavigationUIStateController>()
const routeControllers = new Map<string, NavigationUIStateController>()
const pendingUIStateByKey = new Map<string, NavigationHistoryUIState>()

function getEntryKey(entry: NavigationHistoryEntry) {
  if (entry.type === 'route') {
    return `route:${entry.routeName}`
  }

  return `${entry.type}:${entry.id}`
}

export function registerNavigationNoteUIState(
  noteId: number,
  controller: NavigationUIStateController,
) {
  noteControllers.set(noteId, controller)

  return () => {
    if (noteControllers.get(noteId) === controller) {
      noteControllers.delete(noteId)
    }
  }
}

export function registerNavigationRouteUIState(
  routeName: string,
  controller: NavigationUIStateController,
) {
  routeControllers.set(routeName, controller)

  return () => {
    if (routeControllers.get(routeName) === controller) {
      routeControllers.delete(routeName)
    }
  }
}

export function captureNavigationUIState(
  entry: NavigationHistoryEntry,
): NavigationHistoryUIState | undefined {
  if (entry.type === 'route') {
    const controller = routeControllers.get(entry.routeName)

    if (!controller) {
      return
    }

    return {
      scrollTop: controller.getScrollTop(),
    }
  }

  if (entry.type !== 'note') {
    return
  }

  const controller = noteControllers.get(entry.id)

  if (!controller) {
    return
  }

  return {
    scrollTop: controller.getScrollTop(),
  }
}

export function queueNavigationUIStateRestore(entry: NavigationHistoryEntry) {
  if (!entry.uiState) {
    return
  }

  pendingUIStateByKey.set(getEntryKey(entry), entry.uiState)
}

export function applyPendingNavigationUIStateForNote(noteId: number) {
  const key = `note:${noteId}`
  const pending = pendingUIStateByKey.get(key)
  const controller = noteControllers.get(noteId)

  if (!pending || !controller) {
    return false
  }

  controller.setScrollTop(pending.scrollTop)
  pendingUIStateByKey.delete(key)
  return true
}

export function applyPendingNavigationUIStateForRoute(routeName: string) {
  const key = `route:${routeName}`
  const pending = pendingUIStateByKey.get(key)
  const controller = routeControllers.get(routeName)

  if (!pending || !controller) {
    return false
  }

  controller.setScrollTop(pending.scrollTop)
  pendingUIStateByKey.delete(key)
  return true
}

export function clearNavigationUIStateForTests() {
  noteControllers.clear()
  routeControllers.clear()
  pendingUIStateByKey.clear()
}
