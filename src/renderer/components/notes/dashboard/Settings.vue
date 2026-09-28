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
    key: 'graphPreview',
    label: i18n.t('notes.dashboard.widgets.graphPreview'),
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
]
</script>

<template>
  <div class="flex flex-col">
    <div class="border-border border-b px-4 py-3">
      <UiText
        as="div"
        variant="base"
        weight="semibold"
      >
        {{ i18n.t("notes.dashboard.widgets.title") }}
      </UiText>
      <UiText
        as="div"
        variant="xs"
        muted
        class="mt-1"
      >
        {{ i18n.t("notes.dashboard.widgets.description") }}
      </UiText>
    </div>
    <div class="flex flex-col gap-3 px-4 py-4">
      <label
        v-for="item in widgetItems"
        :key="item.key"
        class="flex items-center justify-between gap-3"
      >
        <UiText
          as="span"
          variant="base"
        >
          {{ item.label }}
        </UiText>
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
        variant="outline"
        @click="showAllDashboardWidgets"
      >
        {{ i18n.t("notes.dashboard.actions.showAllWidgets") }}
      </Button>
    </div>
  </div>
</template>
