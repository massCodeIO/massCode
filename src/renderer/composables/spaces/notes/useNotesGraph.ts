import type { NotesGraphResponse } from '@/services/api/generated'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'

const graphData = shallowRef<NotesGraphResponse | null>(null)
const isGraphLoading = ref(false)
const graphError = ref<string | null>(null)

async function getNotesGraph() {
  try {
    isGraphLoading.value = true
    graphError.value = null

    const { data } = await api.notes.getNotesGraph()
    graphData.value = data
  }
  catch (error) {
    graphError.value
      = error instanceof Error ? error.message : 'Failed to load graph'
    console.error(error)
  }
  finally {
    isGraphLoading.value = false
  }
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
