import type { SavedState, StateAction } from './types'
import { store } from '@/electron'

const isSponsored = import.meta.env.VITE_SPONSORED === 'true'

const stateSnapshots = reactive<Record<StateAction, SavedState>>({
  beforeSearch: {},
})

const state = reactive<SavedState>(store.app.get('state') as SavedState)
const storedSidebarHidden = store.app.get('state.isSidebarHidden') as
  | boolean
  | undefined
const isSidebarHidden = ref(
  storedSidebarHidden ?? state.isSidebarHidden ?? false,
)

if (state.isSidebarHidden === undefined)
  state.isSidebarHidden = isSidebarHidden.value

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedSnippetIds = ref<Set<number>>(new Set())
const highlightedTagId = ref<number>()
const focusedFolderId = ref<number | undefined>()
const focusedSnippetId = ref<number | undefined>()

const isAppLoading = ref(true)
const isCodeSpaceInitialized = ref(false)
const isFocusedSnippetName = ref(false)
const isFocusedSearch = ref(false)
const isShowCodePreview = ref(false)
const isShowCodeImage = ref(false)
const isShowJsonVisualizer = ref(false)

function saveStateSnapshot(action: StateAction): void {
  stateSnapshots[action] = {
    snippetId: state.snippetId,
    folderId: state.folderId,
    tagId: state.tagId,
    snippetContentIndex: state.snippetContentIndex,
    libraryFilter: state.libraryFilter,
    isSidebarHidden: isSidebarHidden.value,
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
  if (snapshot.isSidebarHidden !== undefined)
    isSidebarHidden.value = snapshot.isSidebarHidden
}

watch(
  state,
  () => {
    store.app.set('state', JSON.parse(JSON.stringify(state)))
  },
  { deep: true },
)

watch(isSidebarHidden, (value) => {
  state.isSidebarHidden = value
})

export function useApp() {
  return {
    focusedFolderId,
    focusedSnippetId,
    isAppLoading,
    isCodeSpaceInitialized,
    highlightedFolderIds,
    highlightedSnippetIds,
    highlightedTagId,
    isFocusedSnippetName,
    isFocusedSearch,
    isShowCodeImage,
    isShowCodePreview,
    isShowJsonVisualizer,
    isSidebarHidden,
    isSponsored,
    restoreStateSnapshot,
    saveStateSnapshot,
    state,
    stateSnapshots,
  }
}
