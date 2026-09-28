import type { NativeBridgeResult } from './nativeBridges'
import type { AiNativeAction } from '~/shared/aiNativeActions'
import { getNotesHeatmapCells } from '@/components/notes/dashboard/activityHeatmap'
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useNotes } from '@/composables/spaces/notes/useNotes'
import { useNotesApp } from '@/composables/spaces/notes/useNotesApp'
import { useNotesDashboard } from '@/composables/spaces/notes/useNotesDashboard'
import { useNotesGraph } from '@/composables/spaces/notes/useNotesGraph'
import { useNotesWorkspaceNavigation } from '@/composables/spaces/notes/useNotesWorkspaceNavigation'
import { useApp } from '@/composables/useApp'
import { useContentSort } from '@/composables/useContentSort'
import { useSnippets } from '@/composables/useSnippets'
import { store } from '@/electron'
import { router, RouterName } from '@/router'
import { matchesNativeTarget, readNativeState } from './nativeActions'
import { useAi } from './useAi'

type WorkspaceViewAction = Extract<
  AiNativeAction,
  {
    action:
      | 'readNotesDashboard'
      | 'notesLibrary'
      | 'notesPage'
      | 'notesInspector'
      | 'listView'
  }
>
export async function executeWorkspaceView(
  action: WorkspaceViewAction,
  current: () => boolean,
): Promise<NativeBridgeResult> {
  if (!current())
    return { status: 'stale' }
  if (action.action === 'notesLibrary') {
    const loaded = await useNotesWorkspaceNavigation().openNotesLibrary(
      action.filter,
      current,
    )
    return {
      status: !current() ? 'stale' : loaded ? 'done' : 'unavailable',
      state: readNativeState(),
    }
  }
  if (action.action === 'notesPage' || action.action === 'readNotesDashboard') {
    const route
      = action.action === 'notesPage'
        ? action.page === 'dashboard'
          ? RouterName.notesDashboard
          : RouterName.notesGraph
        : undefined
    if (route) {
      await router.push({ name: route })
      await nextTick()
      if (!current() || router.currentRoute.value.name !== route)
        return { status: 'stale' }
    }
    if (action.action === 'readNotesDashboard' || action.page === 'dashboard') {
      const dashboard = useNotesDashboard()
      await dashboard.getNotesDashboard()
      if (dashboard.dashboardError.value || !dashboard.dashboardData.value)
        return { status: 'failed' }
      if (!current() || (route && router.currentRoute.value.name !== route))
        return { status: 'stale' }
      const data = dashboard.dashboardData.value
      const cells = getNotesHeatmapCells(data.activity.days)
      return {
        status: 'done',
        state: readNativeState(),
        dashboard: {
          stats: data.stats,
          activity: {
            ...data.activity,
            days: Object.fromEntries(Object.entries(data.activity.days)),
          },
          recent: data.recent,
          topLinked: data.topLinked,
          heatmap: {
            from: cells[0]!.key,
            to: cells.at(-1)!.key,
            count: cells.length,
            totalUpdates: cells.reduce((sum, cell) => sum + cell.count, 0),
          },
        },
      }
    }
    else {
      const graph = useNotesGraph()
      await graph.getNotesGraph()
      await nextTick()
      if (!current() || router.currentRoute.value.name !== route)
        return { status: 'stale' }
      if (graph.graphError.value || !graph.graphData.value)
        return { status: 'failed' }
    }
    return {
      status:
        current() && router.currentRoute.value.name === route
          ? 'done'
          : 'stale',
      state: readNativeState(),
    }
  }
  if (action.action === 'notesInspector') {
    if (!matchesNativeTarget(action.target))
      return { status: 'stale' }
    const notes = useNotesApp()
    if (
      action.visible
      && (notes.isNotesMindmapShown.value || notes.isNotesPresentationShown.value)
    ) {
      return { status: 'unavailable' }
    }
    useAi().setOpen(false)
    notes.notesInspectorTab.value = action.tab
    notes.isNotesInspectorOpen.value = action.visible
    await nextTick()
    return {
      status:
        current() && matchesNativeTarget(action.target) ? 'done' : 'stale',
      panel: action.tab,
    }
  }
  if (readNativeState().space !== action.space)
    return { status: 'stale' }
  if (action.compact !== undefined && action.space === 'http')
    return { status: 'unavailable' }
  if (
    (action.hideCompleted !== undefined || action.createKind !== undefined)
    && action.space !== 'notes'
  ) {
    return { status: 'unavailable' }
  }
  let creation: NativeBridgeResult | undefined
  if (action.createKind !== undefined) {
    const { setNativePreferences } = await import('./nativePreferences')
    creation = await setNativePreferences(
      { group: 'notesCreation', values: { kind: action.createKind } },
      current,
    )
    if (creation.status !== 'done')
      return creation
    if (!current())
      return { ...creation, status: 'stale' }
  }
  if (action.hideCompleted !== undefined)
    useNotesApp().hideCompletedTasksInFolders.value = action.hideCompleted
  const { setContentSortField, setContentSortOrder, getContentSortQuery }
    = useContentSort()
  if (action.sort)
    setContentSortField(action.space, action.sort)
  if (action.order)
    setContentSortOrder(action.space, action.order)
  if (action.compact !== undefined)
    useApp().isCompactListMode.value = action.compact
  if (action.layout) {
    if (action.space === 'code')
      useApp().setCodeLayoutMode(action.layout)
    else if (action.space === 'notes')
      useNotesApp().setNotesLayoutMode(action.layout)
    else useHttpApp().httpLayoutMode.value = action.layout
  }
  await nextTick()
  if (action.sort || action.order || action.hideCompleted !== undefined) {
    const loaded
      = action.space === 'code'
        ? await useSnippets().getSnippets()
        : action.space === 'notes'
          ? await useNotes().getNotes()
          : await useHttpRequests().getHttpRequests()
    if (!loaded)
      return { ...creation, status: 'failed' }
  }
  const query = getContentSortQuery(action.space)
  const stored = store.app.get<typeof query>(`${action.space}.contentSort`)
  const persisted
    = (action.hideCompleted === undefined
      || store.app.get('notes.hideCompletedTasksInFolders')
      === action.hideCompleted)
    && (!action.sort || stored?.sort === action.sort)
    && (!action.order || stored?.order === action.order)
    && (action.compact === undefined
      || store.app.get('ui.compactListMode') === action.compact)
    && (!action.layout
      || store.app.get(`${action.space}.layout.mode`) === action.layout)
  const unchanged
    = (!action.sort || query.sort === action.sort)
      && (!action.order || query.order === action.order)
      && readNativeState().space === action.space
  return {
    ...creation,
    status: !current() || !unchanged ? 'stale' : persisted ? 'done' : 'failed',
    persisted,
    state: readNativeState(),
  }
}
