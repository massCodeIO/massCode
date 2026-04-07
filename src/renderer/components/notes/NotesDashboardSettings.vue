<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Switch } from '@/components/ui/shadcn/switch'
import {
  type NotesDashboardWidgetsState,
  useNotesDashboard,
} from '@/composables'
import { i18n } from '@/electron'

const {
  dashboardWidgets,
  setDashboardWidgetVisibility,
  showAllDashboardWidgets,
} = useNotesDashboard()

const widgetItems: Array<{
  key: keyof NotesDashboardWidgetsState
  label: string
}> = [
  {
    key: 'stats',
    label: i18n.t('notes.dashboard.widgets.stats'),
  },
  {
    key: 'activitySummary',
    label: i18n.t('notes.dashboard.widgets.activitySummary'),
  },
  {
    key: 'activityHeatmap',
    label: i18n.t('notes.dashboard.widgets.activityHeatmap'),
  },
  {
    key: 'recent',
    label: i18n.t('notes.dashboard.widgets.recent'),
  },
  {
    key: 'topLinked',
    label: i18n.t('notes.dashboard.widgets.topLinked'),
  },
  {
    key: 'graphPreview',
    label: i18n.t('notes.dashboard.widgets.graphPreview'),
  },
]
</script>

<template>
  <div class="flex flex-col">
    <div class="border-border border-b px-4 py-3">
      <div class="text-sm font-semibold">
        {{ i18n.t("notes.dashboard.widgets.title") }}
      </div>
      <div class="text-muted-foreground mt-1 text-xs">
        {{ i18n.t("notes.dashboard.widgets.description") }}
      </div>
    </div>
    <div class="flex flex-col gap-3 px-4 py-4">
      <label
        v-for="item in widgetItems"
        :key="item.key"
        class="flex items-center justify-between gap-3"
      >
        <span class="text-sm">
          {{ item.label }}
        </span>
        <Switch
          :model-value="dashboardWidgets[item.key]"
          @update:model-value="
            setDashboardWidgetVisibility(item.key, Boolean($event))
          "
        />
      </label>
    </div>
    <div class="border-border border-t px-4 py-3">
      <Button
        class="w-full"
        size="sm"
        variant="outline"
        @click="showAllDashboardWidgets"
      >
        {{ i18n.t("notes.dashboard.actions.showAllWidgets") }}
      </Button>
    </div>
  </div>
</template>
