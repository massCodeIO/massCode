<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { Button } from '@/components/ui/shadcn/button'
import { Calendar } from '@/components/ui/shadcn/calendar'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Popover from '@/components/ui/shadcn/popover'
import * as Select from '@/components/ui/shadcn/select'
import {
  createTaskCompletionPatch,
  getTaskDue,
  getTaskPriority,
  getTaskStatus,
  isTaskNote,
  NoteTaskPriority,
  NoteTaskStatus,
  useNotes,
} from '@/composables'
import { i18n } from '@/electron'
import { cn } from '@/utils'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { format, isValid, parseISO } from 'date-fns'
import { CalendarIcon, CircleCheck, Flag, X } from 'lucide-vue-next'

interface NoteRecord {
  id: number
  properties: Record<string, unknown>
}

interface Props {
  note: NoteRecord
}

const props = defineProps<Props>()

const { updateNoteProperties } = useNotes()

const defaultDuePlaceholder = today(getLocalTimeZone())
const isTask = computed(() => isTaskNote(props.note))
const status = computed(() => getTaskStatus(props.note))
const priority = computed(() => getTaskPriority(props.note) || '')
const due = computed(() => getTaskDue(props.note))
const isDone = computed(() => status.value === NoteTaskStatus.Done)
const selectedDueDate = computed<DateValue | undefined>(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due.value)) {
    return undefined
  }

  try {
    return parseDate(due.value)
  }
  catch {
    return undefined
  }
})
const dueLabel = computed(() => {
  if (!due.value) {
    return i18n.t('notes.tasks.duePlaceholder')
  }

  const parsedDue = parseISO(due.value)

  if (!isValid(parsedDue)) {
    return due.value
  }

  return format(parsedDue, 'dd.MM.yyyy')
})

const statusItems = [
  { value: NoteTaskStatus.Todo, label: i18n.t('notes.tasks.status.todo') },
  {
    value: NoteTaskStatus.InProgress,
    label: i18n.t('notes.tasks.status.inProgress'),
  },
  { value: NoteTaskStatus.Done, label: i18n.t('notes.tasks.status.done') },
  {
    value: NoteTaskStatus.Blocked,
    label: i18n.t('notes.tasks.status.blocked'),
  },
]

const priorityItems = [
  { value: NoteTaskPriority.Low, label: i18n.t('notes.tasks.priority.low') },
  {
    value: NoteTaskPriority.Medium,
    label: i18n.t('notes.tasks.priority.medium'),
  },
  { value: NoteTaskPriority.High, label: i18n.t('notes.tasks.priority.high') },
]

async function toggleDone() {
  await updateNoteProperties(
    props.note.id,
    createTaskCompletionPatch(props.note),
  )
}

async function updateStatus(value: unknown) {
  if (typeof value !== 'string') {
    return
  }

  await updateNoteProperties(props.note.id, {
    properties: {
      status: value,
      type: 'task',
    },
  })
}

async function updatePriority(value: unknown) {
  if (typeof value !== 'string') {
    return
  }

  await updateNoteProperties(props.note.id, {
    properties: {
      priority: value,
      type: 'task',
    },
  })
}

async function saveDue(nextDue?: string) {
  await updateNoteProperties(
    props.note.id,
    nextDue
      ? {
          properties: {
            due: nextDue,
            type: 'task',
          },
        }
      : {
          unset: ['due'],
        },
  )
}

async function updateDue(value: DateValue | undefined) {
  await saveDue(value?.toString())
}

async function clearDue() {
  await saveDue()
}

async function updateDueAndClose(
  value: DateValue | undefined,
  close: () => void,
) {
  await updateDue(value)
  close()
}

async function clearDueAndClose(close: () => void) {
  await clearDue()
  close()
}
</script>

<template>
  <div
    v-if="isTask"
    class="border-border border-b px-2 py-1"
  >
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex h-7 items-center gap-2">
        <Checkbox
          :model-value="isDone"
          @update:model-value="toggleDone"
        />
        <UiText
          as="span"
          variant="xs"
          muted
        >
          {{ i18n.t("notes.tasks.complete") }}
        </UiText>
      </label>

      <Select.Select
        :model-value="status"
        @update:model-value="updateStatus"
      >
        <Select.SelectTrigger class="h-7 w-[128px]">
          <CircleCheck class="size-3.5" />
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="item in statusItems"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>

      <Select.Select
        :model-value="priority"
        @update:model-value="updatePriority"
      >
        <Select.SelectTrigger class="h-7 w-[116px]">
          <Flag class="size-3.5" />
          <Select.SelectValue
            :placeholder="i18n.t('notes.tasks.priority.label')"
          />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="item in priorityItems"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>

      <Popover.Popover v-slot="{ close }">
        <Popover.PopoverTrigger as-child>
          <Button
            variant="outline"
            size="iconText"
            :class="
              cn(
                'h-7 w-[164px] justify-start px-2 text-left font-normal',
                !due && 'text-muted-foreground',
              )
            "
          >
            <CalendarIcon class="size-3.5" />
            <span class="truncate">{{ dueLabel }}</span>
          </Button>
        </Popover.PopoverTrigger>
        <Popover.PopoverContent
          align="start"
          class="w-auto p-0"
        >
          <Calendar
            :model-value="selectedDueDate"
            :default-placeholder="defaultDuePlaceholder"
            layout="month-and-year"
            initial-focus
            @update:model-value="(value) => updateDueAndClose(value, close)"
          />
          <div
            v-if="due"
            class="border-border border-t p-2"
          >
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-start"
              @click="clearDueAndClose(close)"
            >
              <X class="size-3.5" />
              {{ i18n.t("notes.tasks.clearDue") }}
            </Button>
          </div>
        </Popover.PopoverContent>
      </Popover.Popover>
    </div>
  </div>
</template>
