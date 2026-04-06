<script setup lang="ts">
import { useNotesDashboard } from '@/composables'
import { i18n } from '@/electron'
import { useElementSize } from '@vueuse/core'
import { LoaderCircle } from 'lucide-vue-next'

const {
  dashboardData,
  dashboardError,
  dashboardWidgets,
  hasVisibleWidgets,
  isDashboardLoading,
  getNotesDashboard,
} = useNotesDashboard()

const dashboardGridRef = ref<HTMLElement>()
const { width: dashboardWidth } = useElementSize(dashboardGridRef)

const isTwoColumnLayout = computed(() => dashboardWidth.value >= 1180)

onMounted(() => {
  if (!dashboardData.value) {
    void getNotesDashboard()
  }
})
</script>

<template>
  <div class="h-full overflow-auto">
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
        ref="dashboardGridRef"
        class="grid gap-4"
        :class="isTwoColumnLayout ? 'grid-cols-12' : 'grid-cols-1'"
      >
        <div
          v-if="dashboardWidgets.stats"
          :class="isTwoColumnLayout ? 'col-span-12' : 'col-span-1'"
        >
          <NotesDashboardStats :stats="dashboardData.stats" />
        </div>
        <div
          v-if="dashboardWidgets.activityHeatmap"
          :class="isTwoColumnLayout ? 'col-span-8' : 'col-span-1'"
        >
          <NotesDashboardActivityHeatmap :activity="dashboardData.activity" />
        </div>
        <div
          v-if="dashboardWidgets.activitySummary"
          :class="isTwoColumnLayout ? 'col-span-4' : 'col-span-1'"
        >
          <NotesDashboardActivitySummary :activity="dashboardData.activity" />
        </div>
        <div
          v-if="dashboardWidgets.recent"
          :class="isTwoColumnLayout ? 'col-span-5' : 'col-span-1'"
        >
          <NotesDashboardRecent :recent="dashboardData.recent" />
        </div>
        <div
          v-if="dashboardWidgets.tagCloud"
          :class="isTwoColumnLayout ? 'col-span-7' : 'col-span-1'"
        >
          <NotesDashboardTagCloud :tags="dashboardData.tags" />
        </div>
        <div
          v-if="dashboardWidgets.graphPreview"
          :class="isTwoColumnLayout ? 'col-span-8' : 'col-span-1'"
        >
          <NotesDashboardGraphPreview
            :graph-preview="dashboardData.graphPreview"
          />
        </div>
        <div
          v-if="dashboardWidgets.topLinked"
          :class="isTwoColumnLayout ? 'col-span-4' : 'col-span-1'"
        >
          <NotesDashboardTopLinked :top-linked="dashboardData.topLinked" />
        </div>
      </div>
    </div>
  </div>
</template>
