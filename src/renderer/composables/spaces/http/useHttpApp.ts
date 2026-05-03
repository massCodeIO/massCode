import { store } from '@/electron'
import {
  getNextLayoutModeForSidebarToggle,
  type LayoutMode,
} from '../../layoutModes'

export interface HttpSpaceState {
  folderId?: number
  requestId?: number
}

export type HttpStateAction = 'beforeSearch'

export interface HttpSavedState {
  folderId?: number
  requestId?: number
}

const httpState = reactive<HttpSpaceState>(
  (store.app.get('http.selection') as HttpSpaceState) || {},
)

const stateSnapshots = reactive<Record<HttpStateAction, HttpSavedState>>({
  beforeSearch: {},
})

const isHttpSpaceInitialized = ref(false)
const isFocusedSearch = ref(false)

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedRequestIds = ref<Set<number>>(new Set())
const focusedFolderId = ref<number | undefined>()
const focusedRequestId = ref<number | undefined>()

const httpLayoutMode = ref<LayoutMode>(
  (store.app.get('http.layout.mode') as LayoutMode) || 'all-panels',
)

const isHttpSidebarHidden = computed({
  get: () => httpLayoutMode.value !== 'all-panels',
  set: (value: boolean) => {
    httpLayoutMode.value = value ? 'list-editor' : 'all-panels'
  },
})

const isHttpListHidden = computed({
  get: () => httpLayoutMode.value === 'editor-only',
  set: (value: boolean) => {
    httpLayoutMode.value = value ? 'editor-only' : 'list-editor'
  },
})

function saveHttpStateSnapshot(action: HttpStateAction): void {
  stateSnapshots[action] = {
    folderId: httpState.folderId,
    requestId: httpState.requestId,
  }
}

function restoreHttpStateSnapshot(action: HttpStateAction): void {
  const snapshot = stateSnapshots[action]
  if (!snapshot)
    return

  if (snapshot.folderId !== undefined)
    httpState.folderId = snapshot.folderId
  if (snapshot.requestId !== undefined)
    httpState.requestId = snapshot.requestId
}

function setHttpLayoutMode(value: LayoutMode) {
  httpLayoutMode.value = value
}

function toggleHttpSidebar() {
  httpLayoutMode.value = getNextLayoutModeForSidebarToggle(
    httpLayoutMode.value,
  )
}

watch(
  httpState,
  () => {
    store.app.set('http.selection', JSON.parse(JSON.stringify(httpState)))
  },
  { deep: true },
)

watch(httpLayoutMode, (mode) => {
  store.app.set('http.layout.mode', mode)
})

export function useHttpApp() {
  return {
    httpState,
    isHttpSpaceInitialized,
    isFocusedSearch,
    highlightedFolderIds,
    highlightedRequestIds,
    focusedFolderId,
    focusedRequestId,
    httpLayoutMode,
    isHttpSidebarHidden,
    isHttpListHidden,
    restoreHttpStateSnapshot,
    saveHttpStateSnapshot,
    setHttpLayoutMode,
    toggleHttpSidebar,
  }
}
