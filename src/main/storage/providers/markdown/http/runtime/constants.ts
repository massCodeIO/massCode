import type { HttpRuntimeCache } from './types'

export const HTTP_STATE_FILE_NAME = '.state.yaml'
export const HTTP_HISTORY_CAP = 200

export const httpRuntimeRef: { cache: HttpRuntimeCache | null } = {
  cache: null,
}
