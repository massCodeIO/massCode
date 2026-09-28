import type { NotesGraphResponse } from '@/services/api/generated'
import { store } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'

const graphData = shallowRef<NotesGraphResponse | null>(null)
const isGraphLoading = ref(false)
const graphError = ref<string | null>(null)

let pending: { vault: string, promise: Promise<void> } | undefined
let graphVault: string | undefined
function getNotesGraph(options: { fresh?: boolean } = {}): Promise<void> {
  const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
  if (pending?.vault === vault) {
    if (options.fresh) {
      return pending.promise.then(() => {
        if (
          (store.preferences.get<string>('storage.vaultPath') ?? '') === vault
        )
          return getNotesGraph()
      })
    }
    return pending.promise
  }
  if (graphVault !== vault) {
    graphData.value = null
    graphError.value = null
    graphVault = vault
  }
  isGraphLoading.value = true
  graphError.value = null
  const entry = { vault, promise: Promise.resolve() }
  pending = entry
  entry.promise = (async () => {
    try {
      const { data } = await api.notes.getNotesGraph()
      if (
        pending === entry
        && (store.preferences.get<string>('storage.vaultPath') ?? '') === vault
      ) {
        graphData.value = data
      }
    }
    catch (error) {
      if (
        pending === entry
        && (store.preferences.get<string>('storage.vaultPath') ?? '') === vault
      ) {
        graphError.value
          = error instanceof Error ? error.message : 'Failed to load graph'
        console.error(error)
      }
    }
    finally {
      if (pending === entry) {
        pending = undefined
        isGraphLoading.value = false
      }
    }
  })()
  return entry.promise
}

async function navigateBackToDashboard() {
  await router.push({ name: RouterName.notesDashboard })
}

export function useNotesGraph() {
  return {
    graphData,
    graphError,
    isGraphLoading,
    getNotesGraph,
    navigateBackToDashboard,
  }
}
