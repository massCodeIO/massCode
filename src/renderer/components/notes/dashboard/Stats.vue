<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { useTheme } from '@/composables'
import { i18n } from '@/electron'
import { getNotesHeatmapPalette } from '../shared/heatmapPalette'

defineProps<{
  activity: NotesDashboardResponse['activity']
  stats: NotesDashboardResponse['stats']
}>()

const { isDark } = useTheme()
const numberFormatter = new Intl.NumberFormat()
const heatmapPalette = computed(() => getNotesHeatmapPalette(isDark.value))
const activityDotStyle = computed(() => ({
  backgroundColor: heatmapPalette.value.scale[3],
}))
</script>

<template>
  <NotesDashboardSection :title="i18n.t('notes.dashboard.stats.title')">
    <div class="grid h-full grid-cols-3 grid-rows-2 gap-3">
      <div class="rounded-lg p-3.5">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.notes") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.notesCount) }}
        </UiText>
      </div>
      <div class="rounded-lg p-3.5">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.words") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.wordsCount) }}
        </UiText>
      </div>
      <div class="rounded-lg p-3.5">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
          class="flex items-center gap-2"
        >
          <span
            class="inline-block size-2 rounded-full"
            :style="activityDotStyle"
          />
          {{ i18n.t("notes.dashboard.activity.updatedWeek") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(activity.notesUpdatedLast7Days) }}
        </UiText>
      </div>
      <div class="rounded-lg p-3.5">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.folders") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.foldersCount) }}
        </UiText>
      </div>
      <div class="rounded-lg p-3.5">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.tags") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.tagsCount) }}
        </UiText>
      </div>
      <div class="rounded-lg p-3.5">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
          class="flex items-center gap-2"
        >
          <span
            class="inline-block size-2 rounded-full"
            :style="activityDotStyle"
          />
          {{ i18n.t("notes.dashboard.activity.updatedToday") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(activity.notesUpdatedToday) }}
        </UiText>
      </div>
    </div>
  </NotesDashboardSection>
</template>
