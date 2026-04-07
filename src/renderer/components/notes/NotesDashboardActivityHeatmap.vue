<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { useTheme } from '@/composables'
import { i18n } from '@/electron'
import { useElementSize } from '@vueuse/core'
import { scaleQuantize } from 'd3-scale'
import { getNotesHeatmapPalette } from './notesDashboardPalette'

const props = defineProps<{
  activity: NotesDashboardResponse['activity']
}>()
const { isDark } = useTheme()

const DAY_MS = 24 * 60 * 60 * 1000
const GRID_WEEKS = 53
const GRID_DAYS = 7
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const heatmapPalette = computed(() => getNotesHeatmapPalette(isDark.value))

const formatters = {
  day: new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }),
  weekday: new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
  }),
  month: new Intl.DateTimeFormat(undefined, {
    month: 'short',
  }),
}

const heatmapRef = ref<HTMLElement>()
const { width: heatmapWidth } = useElementSize(heatmapRef)

function getDayKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const cells = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(
    today.getTime() - (GRID_WEEKS * GRID_DAYS - 1) * DAY_MS,
  )

  return Array.from({ length: GRID_WEEKS * GRID_DAYS }, (_, index) => {
    const timestamp = start.getTime() + index * DAY_MS
    const date = new Date(timestamp)
    const key = getDayKey(date)

    return {
      count: props.activity.days[key] ?? 0,
      date,
      key,
      label: `${formatters.weekday.format(date)}, ${formatters.day.format(date)}`,
    }
  })
})

const maxCount = computed(() =>
  Math.max(1, ...cells.value.map(cell => cell.count)),
)

const colorScale = computed(() =>
  scaleQuantize<string>()
    .domain([1, Math.max(1, maxCount.value)])
    .range(heatmapPalette.value.scale.slice(1)),
)

const weeks = computed(() =>
  Array.from({ length: GRID_WEEKS }, (_, weekIndex) =>
    cells.value.slice(weekIndex * GRID_DAYS, weekIndex * GRID_DAYS + GRID_DAYS)),
)

const monthLabels = computed(() => {
  let previousMonth = -1

  return weeks.value.map((week) => {
    const monthStart = week.find(day => day.date.getDate() <= GRID_DAYS)

    if (!monthStart || monthStart.date.getMonth() === previousMonth) {
      return ''
    }

    previousMonth = monthStart.date.getMonth()
    return formatters.month.format(monthStart.date)
  })
})

const totalUpdates = computed(() =>
  cells.value.reduce((sum, cell) => sum + cell.count, 0),
)

const legendColors = computed(() => heatmapPalette.value.scale)
const cellGap = computed(() => {
  if (heatmapWidth.value < 520) {
    return 2
  }

  if (heatmapWidth.value < 760) {
    return 3
  }

  return 4
})

const cellSize = computed(() => {
  const availableWidth = Math.max(320, heatmapWidth.value || 0)
  const labelsWidth = 34
  const usableWidth
    = availableWidth - labelsWidth - (GRID_WEEKS - 1) * cellGap.value
  const nextSize = usableWidth / GRID_WEEKS

  return Math.max(7, Number(nextSize.toFixed(2)))
})

function getCellColor(count: number) {
  if (count === 0) {
    return heatmapPalette.value.scale[0]
  }

  return colorScale.value(count)
}
</script>

<template>
  <NotesDashboardSection
    :title="i18n.t('notes.dashboard.activity.heatmapTitle')"
    :description="i18n.t('notes.dashboard.activity.heatmapDescription')"
  >
    <div
      ref="heatmapRef"
      class="space-y-3"
    >
      <div class="w-full">
        <div
          class="text-muted-foreground mb-2 grid text-[10px]"
          :style="{
            columnGap: `${cellGap}px`,
            gridTemplateColumns: `repeat(${GRID_WEEKS}, minmax(0, ${cellSize}px))`,
            paddingLeft: '34px',
          }"
        >
          <div
            v-for="(label, index) in monthLabels"
            :key="`${label}-${index}`"
            class="leading-none"
          >
            {{ label }}
          </div>
        </div>

        <div class="flex gap-2">
          <div
            class="text-muted-foreground grid grid-rows-7 pt-[1px] text-[10px]"
            :style="{ rowGap: `${cellGap}px` }"
          >
            <div
              v-for="(label, index) in DAY_LABELS"
              :key="`${label}-${index}`"
              class="flex items-center justify-end pr-1 leading-none"
              :style="{
                height: `${cellSize}px`,
                width: '24px',
              }"
            >
              {{ label }}
            </div>
          </div>

          <div
            class="grid grid-flow-col grid-rows-7"
            :style="{
              columnGap: `${cellGap}px`,
              rowGap: `${cellGap}px`,
            }"
          >
            <template
              v-for="week in weeks"
              :key="week[0]?.key"
            >
              <button
                v-for="cell in week"
                :key="cell.key"
                class="rounded-[2px] transition-transform hover:scale-115"
                :style="{
                  backgroundColor: getCellColor(cell.count),
                  height: `${cellSize}px`,
                  width: `${cellSize}px`,
                }"
                :title="`${cell.label}: ${cell.count}`"
              />
            </template>
          </div>
        </div>
      </div>

      <div
        class="flex flex-col gap-2 text-xs md:flex-row md:items-center md:justify-between"
        :style="{ color: heatmapPalette.legendText }"
      >
        <div>
          {{
            i18n.t("notes.dashboard.activity.totalLastYear", {
              count: totalUpdates,
            })
          }}
        </div>
        <div class="flex items-center gap-2">
          <span>{{ i18n.t("notes.dashboard.activity.less") }}</span>
          <div class="flex items-center gap-[4px]">
            <span
              v-for="color in legendColors"
              :key="color"
              class="h-3 w-3 rounded-[2px]"
              :style="{ backgroundColor: color }"
            />
          </div>
          <span>{{ i18n.t("notes.dashboard.activity.more") }}</span>
        </div>
      </div>
    </div>
  </NotesDashboardSection>
</template>
