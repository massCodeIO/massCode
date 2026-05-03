import type {
  HttpHistoryAppendInput,
  HttpHistoryStorage,
} from '../../../../contracts'
import type { HttpHistoryRecord } from '../runtime/types'
import { getVaultPath } from '../../runtime/paths'
import { HTTP_HISTORY_CAP } from '../runtime/constants'
import { getHttpPaths } from '../runtime/paths'
import { saveHttpState } from '../runtime/state'
import { getHttpRuntimeCache } from '../runtime/sync'

export function createHttpHistoryStorage(): HttpHistoryStorage {
  function resolvePaths() {
    return getHttpPaths(getVaultPath())
  }

  function getCache() {
    return getHttpRuntimeCache(resolvePaths())
  }

  return {
    getEntries() {
      const { state } = getCache()
      return [...state.history].sort((a, b) => b.requestedAt - a.requestedAt)
    },

    appendEntry(input: HttpHistoryAppendInput) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      state.counters.historyId += 1
      const id = state.counters.historyId
      const record: HttpHistoryRecord = {
        durationMs: input.durationMs,
        id,
        method: input.method,
        requestedAt: input.requestedAt,
        requestId: input.requestId,
        sizeBytes: input.sizeBytes,
        status: input.status,
        url: input.url,
      }

      if (input.error) {
        record.error = input.error
      }

      state.history.push(record)
      if (state.history.length > HTTP_HISTORY_CAP) {
        state.history = state.history.slice(-HTTP_HISTORY_CAP)
      }

      saveHttpState(paths, state)
      return { id }
    },

    clear() {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)
      state.history = []
      saveHttpState(paths, state)
    },
  }
}
