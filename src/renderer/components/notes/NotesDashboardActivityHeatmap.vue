<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { i18n } from '@/electron'

const props = defineProps<{
  activity: NotesDashboardResponse['activity']
}>()

const DAY_MS = 24 * 60 * 60 * 1000

const formatters = {
  day: new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }),
  weekday: new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
  }),
}

const cells = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: 56 }, (_, index) => {
    const timestamp = today.getTime() - (55 - index) * DAY_MS
    const date = new Date(timestamp)
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    return {
      count: props.activity.days[key] ?? 0,
      key,
      label: `${formatters.weekday.format(date)}, ${formatters.day.format(date)}`,
    }
  })
})

const maxCount = computed(() =>
  Math.max(1, ...cells.value.map(cell => cell.count)),
)

function getCellClass(count: number) {
  if (count === 0) {
    return 'bg-muted'
  }

  const ratio = count / maxCount.value

  if (ratio >= 0.75)
    return 'bg-primary'
  if (ratio >= 0.5)
    return 'bg-primary/70'
  if (ratio >= 0.25)
    return 'bg-primary/45'

  return 'bg-primary/25'
}
</script>

<template>
  <NotesDashboardSection
    :title="i18n.t('notes.dashboard.activity.heatmapTitle')"
    :description="i18n.t('notes.dashboard.activity.heatmapDescription')"
  >
    <div class="grid grid-flow-col grid-rows-7 gap-1">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="h-4 rounded-sm"
        :class="getCellClass(cell.count)"
        :title="`${cell.label}: ${cell.count}`"
      />
    </div>
  </NotesDashboardSection>
</template>
