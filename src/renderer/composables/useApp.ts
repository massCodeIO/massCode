import type { SavedState, StateAction } from './types'
import { store } from '@/electron'
import { useCssVar } from '@vueuse/core'

const stateSnapshots = reactive<Record<StateAction, SavedState>>({
  beforeSearch: {},
})

const state = reactive<SavedState>(store.app.get('state') as SavedState)

const highlightedFolderId = ref<number>()
const highlightedSnippetIds = ref<Set<number>>(new Set())
const highlightedTagId = ref<number>()

const isFocusedSnippetName = ref(false)

const sidebarWidth = useCssVar('--sidebar-width')
const snippetListWidth = useCssVar('--snippet-list-width')

sidebarWidth.value = `${store.app.get('sizes.sidebarWidth')}px`
snippetListWidth.value = `${store.app.get('sizes.snippetListWidth')}px`

function saveStateSnapshot(action: StateAction): void {
  stateSnapshots[action] = {
    snippetId: state.snippetId,
    folderId: state.folderId,
    tagId: state.tagId,
    snippetContentIndex: state.snippetContentIndex,
    libraryFilter: state.libraryFilter,
  }
}

function restoreStateSnapshot(action: StateAction): void {
  const snapshot = stateSnapshots[action]

  if (!snapshot)
    return

  if (snapshot.snippetId !== undefined)
    state.snippetId = snapshot.snippetId
  if (snapshot.folderId !== undefined)
    state.folderId = snapshot.folderId
  if (snapshot.tagId !== undefined)
    state.tagId = snapshot.tagId
  if (snapshot.snippetContentIndex !== undefined)
    state.snippetContentIndex = snapshot.snippetContentIndex
}

watch(state, () => {
  store.app.set('state', JSON.parse(JSON.stringify(state)))
})

export function useApp() {
  return {
    highlightedFolderId,
    highlightedSnippetIds,
    highlightedTagId,
    isFocusedSnippetName,
    restoreStateSnapshot,
    saveStateSnapshot,
    sidebarWidth,
    snippetListWidth,
    state,
    stateSnapshots,
  }
}
