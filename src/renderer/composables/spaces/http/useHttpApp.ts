export interface HttpSpaceState {
  folderId?: number
  requestId?: number
}

const httpState = reactive<HttpSpaceState>({})

const isHttpSpaceInitialized = ref(false)

const highlightedFolderIds = ref<Set<number>>(new Set())
const highlightedRequestIds = ref<Set<number>>(new Set())
const focusedFolderId = ref<number | undefined>()
const focusedRequestId = ref<number | undefined>()

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
