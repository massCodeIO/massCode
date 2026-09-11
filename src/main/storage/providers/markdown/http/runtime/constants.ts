import type { HttpRuntimeCache } from './types'

export const HTTP_STATE_FILE_NAME = '.state.yaml'

export const httpRuntimeRef: { cache: HttpRuntimeCache | null } = {
  cache: null,
}

export function peekHttpRuntimeCache(): HttpRuntimeCache | null {
  return httpRuntimeRef.cache
}
