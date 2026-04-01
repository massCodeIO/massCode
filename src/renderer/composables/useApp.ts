import type { SavedState, StateAction } from './types'
import { store } from '@/electron'
import {
  getCodeLayoutModeFromLegacyState,
  getNextLayoutModeForSidebarToggle,
  type LayoutMode,
} from './layoutModes'

const isSponsored = import.meta.env.VITE_SPONSORED === 'true'

const stateSnapshots = reactive<Record<StateAction, SavedState>>({
  beforeSearch: {},
})

const state = reactive<SavedState>(
  store.app.get('code.selection') as SavedState,
)
const storedCodeLayoutMode = store.app.get('code.layout.mode') as
  | LayoutMode
  | undefined
const codeLayoutMode = ref<LayoutMode>(
  storedCodeLayoutMode
  ?? getCodeLayoutModeFromLegacyState(state.isSidebarHidden),
)
const isSidebarHidden = computed({
  get: () => codeLayoutMode.value !== 'all-panels',
  set: (value: boolean) => {
    codeLayoutMode.value = value ? 'list-editor' : 'all-panels'
  },
})

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedSnippetIds = ref<Set<number>>(new Set())
const highlightedTagId = ref<number>()
const focusedFolderId = ref<number | undefined>()
const focusedSnippetId = ref<number | undefined>()

const isAppLoading = ref(true)
const isCodeSpaceInitialized = ref(false)
const pendingCodeNavigation = ref(false)
const isCompactListMode = ref(
  (store.app.get('ui.compactListMode') as boolean | undefined) ?? false,
)
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
    codeLayoutMode: codeLayoutMode.value,
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
  if (snapshot.codeLayoutMode !== undefined) {
    codeLayoutMode.value = snapshot.codeLayoutMode
  }
  else if (snapshot.isSidebarHidden !== undefined) {
    isSidebarHidden.value = snapshot.isSidebarHidden
  }
}

watch(
  state,
  () => {
    store.app.set('code.selection', JSON.parse(JSON.stringify(state)))
  },
  { deep: true },
)

watch(codeLayoutMode, (value) => {
  store.app.set('code.layout.mode', value)
})

watch(isCompactListMode, (value) => {
  store.app.set('ui.compactListMode', value)
})

function setCodeLayoutMode(value: LayoutMode) {
  codeLayoutMode.value = value
}

function toggleCompactListMode() {
  isCompactListMode.value = !isCompactListMode.value
}

function toggleCodeSidebar() {
  codeLayoutMode.value = getNextLayoutModeForSidebarToggle(
    codeLayoutMode.value,
  )
}

export function useApp() {
  return {
    codeLayoutMode,
    focusedFolderId,
    focusedSnippetId,
    isAppLoading,
    isCodeSpaceInitialized,
    pendingCodeNavigation,
    highlightedFolderIds,
    highlightedSnippetIds,
    highlightedTagId,
    isCompactListMode,
    isFocusedSnippetName,
    isFocusedSearch,
    isShowCodeImage,
    isShowCodePreview,
    isShowJsonVisualizer,
    isSidebarHidden,
    isSponsored,
    restoreStateSnapshot,
    saveStateSnapshot,
    setCodeLayoutMode,
    state,
    stateSnapshots,
    toggleCodeSidebar,
    toggleCompactListMode,
  }
}
