export interface HttpSpaceState {
  folderId?: number
  requestId?: number
}

const httpState = reactive<HttpSpaceState>({})

const isHttpSpaceInitialized = ref(false)

export function useHttpApp() {
  return {
    httpState,
    isHttpSpaceInitialized,
  }
}
