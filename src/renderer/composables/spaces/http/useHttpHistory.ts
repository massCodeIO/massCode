import type { HttpHistoryResponse } from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '@/services/api'

export type HttpHistoryItem = HttpHistoryResponse[number]

const history = shallowRef<HttpHistoryResponse>([])

async function getHttpHistory() {
  try {
    const { data } = await api.httpHistory.getHttpHistory()
    history.value = data
  }
  catch (error) {
    console.error(error)
  }
}

async function clearHttpHistory() {
  try {
    markPersistedStorageMutation()
    await api.httpHistory.deleteHttpHistory()
    history.value = []
  }
  catch (error) {
    console.error(error)
  }
}

function resetHttpHistoryState() {
  history.value = []
}

export function useHttpHistory() {
  return {
    clearHttpHistory,
    getHttpHistory,
    history,
    resetHttpHistoryState,
  }
}
