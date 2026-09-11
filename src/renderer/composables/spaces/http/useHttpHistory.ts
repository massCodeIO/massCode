import type { HttpHistoryResponse } from '@/services/api/generated'
import type { HttpHistorySnapshot } from '~/shared/httpHistory'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { ipc } from '@/electron'
import { api } from '@/services/api'

export type HttpHistoryItem = HttpHistoryResponse[number]

const history = shallowRef<HttpHistoryResponse>([])
const loading = ref(false)
const loadError = ref(false)
let historyGeneration = 0
const selected = shallowRef<HttpHistoryItem | null>(null)
const snapshot = shallowRef<HttpHistorySnapshot | null>(null)
const loadingSnapshot = ref(false)
const snapshotError = ref(false)
let generation = 0

async function openHistory(item: HttpHistoryItem) {
  const token = ++generation
  selected.value = item
  snapshot.value = null
  snapshotError.value = false
  loadingSnapshot.value = true
  try {
    const data = await ipc.invoke<number, HttpHistorySnapshot | null>(
      'spaces:http:history-snapshot',
      item.id,
    )
    if (generation === token)
      snapshot.value = data
  }
  catch {
    if (generation === token)
      snapshotError.value = true
  }
  finally {
    if (generation === token)
      loadingSnapshot.value = false
  }
}

function closeHistory() {
  generation++
  selected.value = null
  snapshot.value = null
  loadingSnapshot.value = false
}

async function getHttpHistory() {
  const token = ++historyGeneration
  loading.value = true
  loadError.value = false
  try {
    const { data } = await api.httpHistory.getHttpHistory()
    if (token === historyGeneration)
      history.value = data
  }
  catch {
    if (token === historyGeneration)
      loadError.value = true
  }
  finally {
    if (token === historyGeneration)
      loading.value = false
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
  closeHistory()
  historyGeneration++
  loading.value = false
  loadError.value = false
  history.value = []
}

export function useHttpHistory() {
  return {
    selected,
    snapshot,
    loadingSnapshot,
    loading,
    loadError,
    snapshotError,
    openHistory,
    closeHistory,
    clearHttpHistory,
    getHttpHistory,
    history,
    resetHttpHistoryState,
  }
}
