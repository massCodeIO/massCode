import { store } from '@/electron'

export interface HttpSpaceState {
  folderId?: number
  requestId?: number
}

const httpState = reactive<HttpSpaceState>(
  (store.app.get('http.selection') as HttpSpaceState) || {},
)

const isHttpSpaceInitialized = ref(false)

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedRequestIds = ref<Set<number>>(new Set())
const focusedFolderId = ref<number | undefined>()
const focusedRequestId = ref<number | undefined>()

watch(
  httpState,
  () => {
    store.app.set('http.selection', JSON.parse(JSON.stringify(httpState)))
  },
  { deep: true },
)

export function useHttpApp() {
  return {
    httpState,
    isHttpSpaceInitialized,
    highlightedFolderIds,
    highlightedRequestIds,
    focusedFolderId,
    focusedRequestId,
  }
}
