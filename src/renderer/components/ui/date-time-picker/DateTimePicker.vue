<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { Button } from '@/components/ui/shadcn/button'
import { Calendar } from '@/components/ui/shadcn/calendar'
import { Field, FieldLabel } from '@/components/ui/shadcn/field'
import { Input } from '@/components/ui/shadcn/input'
import * as Popover from '@/components/ui/shadcn/popover'
import { useDateFormat } from '@/composables/useDateFormat'
import {
  fromDate,
  getLocalTimeZone,
  toCalendarDate,
} from '@internationalized/date'
import { CalendarIcon, X } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  label: string
  placeholder: string
  timeLabel: string
  clearLabel: string
  variant?: 'outline' | 'ghost'
  disabled?: boolean
}>()

const { formatDateTime } = useDateFormat()

const model = defineModel<string>({ required: true })
const open = ref(false)
const zone = getLocalTimeZone()
const date = computed(() => {
  const value = model.value ? new Date(model.value) : undefined
  return value && Number.isFinite(value.getTime()) ? value : undefined
})
const day = computed(() =>
  date.value ? toCalendarDate(fromDate(date.value, zone)) : undefined,
)
const time = computed(
  () => date.value?.toTimeString().slice(0, 8) ?? '00:00:00',
)
function setDay(value: DateValue | undefined) {
  if (!value)
    return
  const next = value.toDate(zone)
  const previous = date.value
  next.setHours(
    previous?.getHours() ?? 0,
    previous?.getMinutes() ?? 0,
    previous?.getSeconds() ?? 0,
    0,
  )
  model.value = next.toUTCString()
}
function setTime(value: string | number) {
  if (!date.value || !value)
    return
  const [hour, minute, second = 0] = String(value).split(':').map(Number)
  const next = new Date(date.value)
  next.setHours(hour, minute, second, 0)
  if (Number.isFinite(next.getTime()))
    model.value = next.toUTCString()
}
function clear() {
  model.value = ''
  open.value = false
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1">
    <Popover.Popover v-model:open="open">
      <Popover.PopoverTrigger as-child>
        <Button
          :id="id"
          type="button"
          :variant="variant ?? 'outline'"
          size="iconText"
          class="min-w-0 flex-1 justify-start font-normal"
          :disabled="disabled"
          :aria-label="label"
        >
          <CalendarIcon class="size-3.5 shrink-0" />
          <UiText
            variant="sm"
            class="truncate"
            :muted="!date"
          >
            {{ date ? formatDateTime(date) : placeholder }}
          </UiText>
        </Button>
      </Popover.PopoverTrigger>
      <Popover.PopoverContent
        align="start"
        class="w-auto p-0"
      >
        <Calendar
          :model-value="day"
          :default-placeholder="day"
          :disabled="props.disabled"
          layout="month-and-year"
          initial-focus
          @update:model-value="setDay"
        />
        <Field class="border-border gap-1 border-t p-3">
          <FieldLabel
            :for="`${id}-time`"
            class="text-xs"
          >
            {{ timeLabel }}
          </FieldLabel>
          <Input
            :id="`${id}-time`"
            :model-value="time"
            type="time"
            step="1"
            :disabled="disabled || !date"
            @update:model-value="setTime"
          />
        </Field>
      </Popover.PopoverContent>
    </Popover.Popover>
    <UiActionButton
      type="button"
      :disabled="disabled || !date"
      :tooltip="clearLabel"
      :aria-label="clearLabel"
      @click="clear"
    >
      <X class="size-3.5" />
    </UiActionButton>
  </div>
</template>
