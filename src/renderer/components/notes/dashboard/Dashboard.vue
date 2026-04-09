<script setup lang="ts">
import {
  applyPendingNavigationUIStateForRoute,
  registerNavigationRouteUIState,
  useNotesDashboard,
} from '@/composables'
import { i18n } from '@/electron'
import { RouterName } from '@/router'
import { LoaderCircle } from 'lucide-vue-next'

const {
  dashboardData,
  dashboardError,
  dashboardWidgets,
  enterNotesDashboard,
  hasVisibleWidgets,
  isDashboardLoading,
} = useNotesDashboard()

const dashboardScrollRef = ref<HTMLElement>()
let unregisterNavigationRouteUIState: (() => void) | undefined

onMounted(() => {
  if (dashboardScrollRef.value) {
    unregisterNavigationRouteUIState = registerNavigationRouteUIState(
      RouterName.notesDashboard,
      {
        getScrollTop: () => dashboardScrollRef.value?.scrollTop ?? 0,
        setScrollTop: (scrollTop) => {
          dashboardScrollRef.value?.scrollTo({ top: scrollTop })
        },
      },
    )

    nextTick(() => {
      applyPendingNavigationUIStateForRoute(RouterName.notesDashboard)
    })
  }

  void enterNotesDashboard()
})

watch(
  dashboardData,
  async (data) => {
    if (!data) {
      return
    }

    await nextTick()
    applyPendingNavigationUIStateForRoute(RouterName.notesDashboard)
  },
  { immediate: true },
)

onUnmounted(() => {
  unregisterNavigationRouteUIState?.()
  unregisterNavigationRouteUIState = undefined
})
</script>

<template>
  <div
    ref="dashboardScrollRef"
    class="scrollbar h-full overflow-y-auto"
  >
    <div class="mx-auto flex min-h-full max-w-7xl flex-col gap-4 p-5">
      <NotesDashboardHeader />

      <div
        v-if="isDashboardLoading && !dashboardData"
        class="text-muted-foreground flex flex-1 items-center justify-center"
      >
        <LoaderCircle class="h-5 w-5 animate-spin" />
      </div>

      <UiEmptyPlaceholder
        v-else-if="dashboardError"
        :text="i18n.t('notes.dashboard.error')"
      />

      <UiEmptyPlaceholder
        v-else-if="dashboardData && !hasVisibleWidgets"
        :text="i18n.t('notes.dashboard.empty')"
      />

      <div
        v-else-if="dashboardData"
        class="flex flex-col gap-4"
      >
        <div
          v-if="dashboardWidgets.stats || dashboardWidgets.graphPreview"
          class="grid grid-cols-3 gap-4"
        >
          <div
            v-if="dashboardWidgets.stats"
            :class="dashboardWidgets.graphPreview ? 'col-span-2' : 'col-span-3'"
          >
            <NotesDashboardStats
              :activity="dashboardData.activity"
              :stats="dashboardData.stats"
            />
          </div>
          <div
            v-if="dashboardWidgets.graphPreview"
            :class="dashboardWidgets.stats ? 'col-span-1' : 'col-span-3'"
          >
            <NotesDashboardGraphPreview
              :graph-preview="dashboardData.graphPreview"
            />
          </div>
        </div>

        <div v-if="dashboardWidgets.activityHeatmap">
          <NotesDashboardActivityHeatmap :activity="dashboardData.activity" />
        </div>

        <div
          v-if="dashboardWidgets.recent || dashboardWidgets.topLinked"
          class="grid grid-cols-2 gap-4"
        >
          <div
            v-if="dashboardWidgets.recent"
            :class="dashboardWidgets.topLinked ? 'col-span-1' : 'col-span-2'"
          >
            <NotesDashboardRecent :recent="dashboardData.recent" />
          </div>
          <div
            v-if="dashboardWidgets.topLinked"
            :class="dashboardWidgets.recent ? 'col-span-1' : 'col-span-2'"
          >
            <NotesDashboardTopLinked :top-linked="dashboardData.topLinked" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
