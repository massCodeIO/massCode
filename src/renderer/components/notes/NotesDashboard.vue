<script setup lang="ts">
import { useNotesDashboard } from '@/composables'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'

const {
  dashboardData,
  dashboardError,
  dashboardWidgets,
  hasVisibleWidgets,
  isDashboardLoading,
  getNotesDashboard,
} = useNotesDashboard()

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
        class="grid gap-4 lg:grid-cols-12"
      >
        <div
          v-if="dashboardWidgets.stats"
          class="lg:col-span-12"
        >
          <NotesDashboardStats :stats="dashboardData.stats" />
        </div>
        <div
          v-if="dashboardWidgets.activityHeatmap"
          class="lg:col-span-8"
        >
          <NotesDashboardActivityHeatmap :activity="dashboardData.activity" />
        </div>
        <div
          v-if="dashboardWidgets.activitySummary"
          class="lg:col-span-4"
        >
          <NotesDashboardActivitySummary :activity="dashboardData.activity" />
        </div>
        <div
          v-if="dashboardWidgets.recent"
          class="lg:col-span-5"
        >
          <NotesDashboardRecent :recent="dashboardData.recent" />
        </div>
        <div
          v-if="dashboardWidgets.tagCloud"
          class="lg:col-span-7"
        >
          <NotesDashboardTagCloud :tags="dashboardData.tags" />
        </div>
        <div
          v-if="dashboardWidgets.graphPreview"
          class="lg:col-span-8"
        >
          <NotesDashboardGraphPreview
            :graph-preview="dashboardData.graphPreview"
          />
        </div>
        <div
          v-if="dashboardWidgets.topLinked"
          class="lg:col-span-4"
        >
          <NotesDashboardTopLinked :top-linked="dashboardData.topLinked" />
        </div>
      </div>
    </div>
  </div>
</template>
