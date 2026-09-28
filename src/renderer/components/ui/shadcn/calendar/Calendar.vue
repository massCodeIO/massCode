<script lang="ts" setup>
import type { CalendarRootEmits, CalendarRootProps, DateValue } from 'reka-ui'
import type { HTMLAttributes, Ref } from 'vue'
import type { LayoutTypes } from '.'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/shadcn/native-select'
import { cn } from '@/utils'
import { getLocalTimeZone, today } from '@internationalized/date'
import { createReusableTemplate, reactiveOmit, useVModel } from '@vueuse/core'
import { CalendarRoot, useDateFormatter, useForwardPropsEmits } from 'reka-ui'
import { computed, toRaw } from 'vue'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
} from '.'

const props = withDefaults(
  defineProps<
    CalendarRootProps & {
      class?: HTMLAttributes['class']
      layout?: LayoutTypes
      yearRange?: DateValue[]
    }
  >(),
  {
    modelValue: undefined,
    layout: undefined,
  },
)
const emits = defineEmits<CalendarRootEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'layout', 'placeholder')

const placeholder = useVModel(props, 'placeholder', emits, {
  passive: true,
  defaultValue: props.defaultPlaceholder ?? today(getLocalTimeZone()),
}) as Ref<DateValue>

const formatter = useDateFormatter(props.locale ?? 'en')
const localTimeZone = getLocalTimeZone()

function toDate(value: DateValue) {
  return value.toDate(localTimeZone)
}

function createYear(date: DateValue) {
  return Array.from({ length: 12 }, (_, index) =>
    date.set({ month: index + 1 }))
}

function createYearRange(start: DateValue, end: DateValue) {
  const yearsCount = end.year - start.year + 1

  if (yearsCount <= 0) {
    return []
  }

  return Array.from({ length: yearsCount }, (_, index) =>
    start.set({ year: start.year + index }))
}

const yearRange = computed(() => {
  return (
    props.yearRange
    ?? createYearRange(
      props?.minValue
      ?? (
        toRaw(props.placeholder)
        ?? props.defaultPlaceholder
        ?? today(localTimeZone)
      ).cycle('year', -100),

      props?.maxValue
      ?? (
        toRaw(props.placeholder)
        ?? props.defaultPlaceholder
        ?? today(localTimeZone)
      ).cycle('year', 10),
    )
  )
})

const [DefineMonthTemplate, ReuseMonthTemplate] = createReusableTemplate<{
  date: DateValue
}>()
const [DefineYearTemplate, ReuseYearTemplate] = createReusableTemplate<{
  date: DateValue
}>()

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DefineMonthTemplate v-slot="{ date }">
    <div class="**:data-[slot=native-select-icon]:right-1">
      <div class="relative">
        <div
          class="pointer-events-none absolute inset-0 flex h-full items-center pl-2 text-sm"
        >
          {{ formatter.custom(toDate(date), { month: "short" }) }}
        </div>
        <NativeSelect
          class="relative h-8 pr-6 pl-2 text-xs text-transparent"
          :model-value="date.month"
          @change="
            (e: Event) => {
              placeholder = placeholder.set({
                month: Number((e?.target as any)?.value),
              });
            }
          "
        >
          <NativeSelectOption
            v-for="month in createYear(date)"
            :key="month.toString()"
            :value="month.month"
            :selected="date.month === month.month"
          >
            {{ formatter.custom(toDate(month), { month: "short" }) }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  </DefineMonthTemplate>

  <DefineYearTemplate v-slot="{ date }">
    <div class="**:data-[slot=native-select-icon]:right-1">
      <div class="relative">
        <div
          class="pointer-events-none absolute inset-0 flex h-full items-center pl-2 text-sm"
        >
          {{ formatter.custom(toDate(date), { year: "numeric" }) }}
        </div>
        <NativeSelect
          class="relative h-8 pr-6 pl-2 text-xs text-transparent"
          :model-value="date.year"
          @change="
            (e: Event) => {
              placeholder = placeholder.set({
                year: Number((e?.target as any)?.value),
              });
            }
          "
        >
          <NativeSelectOption
            v-for="year in yearRange"
            :key="year.toString()"
            :value="year.year"
            :selected="date.year === year.year"
          >
            {{ formatter.custom(toDate(year), { year: "numeric" }) }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  </DefineYearTemplate>

  <CalendarRoot
    v-slot="{ grid, weekDays, date }"
    v-bind="forwarded"
    v-model:placeholder="placeholder"
    data-slot="calendar"
    :class="cn('p-3', props.class)"
  >
    <CalendarHeader class="pt-0">
      <nav
        class="absolute inset-x-0 top-0 flex items-center justify-between gap-1"
      >
        <CalendarPrevButton>
          <slot name="calendar-prev-icon" />
        </CalendarPrevButton>
        <CalendarNextButton>
          <slot name="calendar-next-icon" />
        </CalendarNextButton>
      </nav>

      <slot
        name="calendar-heading"
        :date="date"
        :month="ReuseMonthTemplate"
        :year="ReuseYearTemplate"
      >
        <template v-if="layout === 'month-and-year'">
          <div class="flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else-if="layout === 'month-only'">
          <div class="flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            {{ formatter.custom(toDate(date), { year: "numeric" }) }}
          </div>
        </template>
        <template v-else-if="layout === 'year-only'">
          <div class="flex items-center justify-center gap-1">
            {{ formatter.custom(toDate(date), { month: "short" }) }}
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else>
          <CalendarHeading />
        </template>
      </slot>
    </CalendarHeader>

    <div class="mt-4 flex flex-col gap-y-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <CalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
      >
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell
              v-for="day in weekDays"
              :key="day"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow
            v-for="(weekDates, index) in month.rows"
            :key="`weekDate-${index}`"
            class="mt-2 w-full"
          >
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="month.value"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
