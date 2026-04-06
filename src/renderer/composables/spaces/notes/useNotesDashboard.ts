import type { NotesDashboardResponse } from '@/services/api/generated'
import { store } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'

export interface NotesDashboardWidgetsState {
  stats: boolean
  activityHeatmap: boolean
  activitySummary: boolean
  recent: boolean
  tagCloud: boolean
  graphPreview: boolean
  topLinked: boolean
}

const DEFAULT_WIDGETS: NotesDashboardWidgetsState = {
  stats: true,
  activityHeatmap: true,
  activitySummary: true,
  recent: true,
  tagCloud: true,
  graphPreview: true,
  topLinked: true,
}

function readDashboardWidgets(): NotesDashboardWidgetsState {
  const saved = store.app.get('notes.dashboard.widgets') as
    | Partial<NotesDashboardWidgetsState>
    | undefined

  return {
    ...DEFAULT_WIDGETS,
    ...saved,
  }
}

const dashboardData = shallowRef<NotesDashboardResponse | null>(null)
const isDashboardLoading = ref(false)
const dashboardError = ref<string | null>(null)
const dashboardWidgets = ref<NotesDashboardWidgetsState>(
  readDashboardWidgets(),
)

const hasVisibleWidgets = computed(() =>
  Object.values(dashboardWidgets.value).some(Boolean),
)

watch(
  dashboardWidgets,
  (value) => {
    store.app.set('notes.dashboard.widgets', { ...value })
  },
  { deep: true },
)

async function getNotesDashboard() {
  try {
    isDashboardLoading.value = true
    dashboardError.value = null

    const { data } = await api.notes.getNotesDashboard()
    dashboardData.value = data
  }
  catch (error) {
    dashboardError.value
      = error instanceof Error ? error.message : 'Failed to load dashboard'
    console.error(error)
  }
  finally {
    isDashboardLoading.value = false
  }
}

function setDashboardWidgetVisibility(
  key: keyof NotesDashboardWidgetsState,
  value: boolean,
) {
  dashboardWidgets.value[key] = value
}

function showAllDashboardWidgets() {
  dashboardWidgets.value = { ...DEFAULT_WIDGETS }
}

async function navigateToGraph() {
  await router.push({ name: RouterName.notesGraph })
}

export function useNotesDashboard() {
  return {
    dashboardData,
    dashboardError,
    dashboardWidgets,
    hasVisibleWidgets,
    isDashboardLoading,
    getNotesDashboard,
    navigateToGraph,
    setDashboardWidgetVisibility,
    showAllDashboardWidgets,
  }
}
