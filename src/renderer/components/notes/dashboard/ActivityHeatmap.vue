<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import * as Card from '@/components/ui/shadcn/card'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useTheme } from '@/composables'
import { i18n } from '@/electron'
import { useElementSize } from '@vueuse/core'
import { getNotesHeatmapPalette } from '../shared/heatmapPalette'
import {
  getNotesHeatmapColor,
  getNotesHeatmapTooltipLines,
} from './activityHeatmap'

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
  return getNotesHeatmapColor(count, heatmapPalette.value)
}

function getTooltipLines(label: string, count: number) {
  return getNotesHeatmapTooltipLines(label, count, (key, params) =>
    i18n.t(key, params))
}
</script>

<template>
  <Card.Card class="h-full">
    <Card.CardHeader class="border-b">
      <Card.CardTitle>
        {{ i18n.t("notes.dashboard.activity.heatmapTitle") }}
      </Card.CardTitle>
      <Card.CardDescription>
        <UiText
          as="p"
          variant="xs"
          muted
        >
          {{ i18n.t("notes.dashboard.activity.heatmapDescription") }}
        </UiText>
      </Card.CardDescription>
    </Card.CardHeader>
    <Card.CardContent class="min-h-0 flex-1">
      <Tooltip.TooltipProvider :delay-duration="0">
        <div
          ref="heatmapRef"
          class="space-y-3"
        >
          <div class="w-full">
            <div
              class="mb-2 grid"
              :style="{
                columnGap: `${cellGap}px`,
                gridTemplateColumns: `repeat(${GRID_WEEKS}, minmax(0, ${cellSize}px))`,
                paddingLeft: '34px',
              }"
            >
              <UiText
                v-for="(label, index) in monthLabels"
                :key="`${label}-${index}`"
                as="div"
                variant="caption"
                muted
                class="leading-none"
              >
                {{ label }}
              </UiText>
            </div>

            <div class="flex gap-2">
              <div
                class="grid grid-rows-7 pt-[1px]"
                :style="{ rowGap: `${cellGap}px` }"
              >
                <UiText
                  v-for="(label, index) in DAY_LABELS"
                  :key="`${label}-${index}`"
                  as="div"
                  variant="caption"
                  muted
                  class="flex items-center justify-end pr-1 leading-none"
                  :style="{
                    height: `${cellSize}px`,
                    width: '24px',
                  }"
                >
                  {{ label }}
                </UiText>
              </div>

              <div
                class="grid grid-flow-col grid-rows-7"
                :style="{
                  columnGap: `${cellGap}px`,
                  rowGap: `${cellGap}px`,
                }"
              >
                <template
                  v-for="cell in cells"
                  :key="cell.key"
                >
                  <Tooltip.Tooltip v-if="cell.count > 0">
                    <Tooltip.TooltipTrigger as-child>
                      <button
                        type="button"
                        class="rounded-[2px] transition-transform hover:scale-115"
                        :style="{
                          backgroundColor: getCellColor(cell.count),
                          height: `${cellSize}px`,
                          width: `${cellSize}px`,
                        }"
                      />
                    </Tooltip.TooltipTrigger>
                    <Tooltip.TooltipContent side="top">
                      <div class="flex flex-col gap-0.5">
                        <UiText
                          as="span"
                          variant="xs"
                        >
                          {{ getTooltipLines(cell.label, cell.count)[0] }}
                        </UiText>
                        <UiText
                          as="span"
                          variant="xs"
                          muted
                        >
                          {{ getTooltipLines(cell.label, cell.count)[1] }}
                        </UiText>
                      </div>
                    </Tooltip.TooltipContent>
                  </Tooltip.Tooltip>
                  <button
                    v-else
                    type="button"
                    class="rounded-[2px]"
                    :class="
                      !isDark ? 'border-border/70 bg-background border' : ''
                    "
                    :style="{
                      height: `${cellSize}px`,
                      width: `${cellSize}px`,
                      ...(isDark
                        ? { backgroundColor: getCellColor(cell.count) }
                        : {}),
                    }"
                  />
                </template>
              </div>
            </div>
          </div>

          <UiText
            as="div"
            variant="xs"
            muted
            class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
          >
            <span>
              {{
                i18n.t("notes.dashboard.activity.totalLastYear", {
                  count: totalUpdates,
                })
              }}
            </span>
            <div class="flex items-center gap-2">
              <UiText
                as="span"
                variant="xs"
                muted
              >
                {{ i18n.t("notes.dashboard.activity.less") }}
              </UiText>
              <div class="flex items-center gap-[4px]">
                <span
                  v-for="(color, index) in legendColors"
                  :key="color"
                  class="h-3 w-3 rounded-[2px]"
                  :class="
                    !isDark && index === 0
                      ? 'border-border/70 bg-background border'
                      : ''
                  "
                  :style="
                    !isDark && index === 0
                      ? undefined
                      : { backgroundColor: color }
                  "
                />
              </div>
              <UiText
                as="span"
                variant="xs"
                muted
              >
                {{ i18n.t("notes.dashboard.activity.more") }}
              </UiText>
            </div>
          </UiText>
        </div>
      </Tooltip.TooltipProvider>
    </Card.CardContent>
  </Card.Card>
</template>
