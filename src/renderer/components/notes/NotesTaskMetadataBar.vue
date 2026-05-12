<script setup lang="ts">
import { Checkbox } from '@/components/ui/shadcn/checkbox'
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
import { CalendarClock, CircleCheck, Flag } from 'lucide-vue-next'

interface NoteRecord {
  id: number
  properties: Record<string, unknown>
}

interface Props {
  note: NoteRecord
}

const props = defineProps<Props>()

const { updateNoteProperties } = useNotes()

const isTask = computed(() => isTaskNote(props.note))
const status = computed(() => getTaskStatus(props.note))
const priority = computed(() => getTaskPriority(props.note) || '')
const due = computed(() => getTaskDue(props.note))
const isDone = computed(() => status.value === NoteTaskStatus.Done)

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

async function updateDue(value: string | number | undefined) {
  const nextDue = String(value || '').trim()

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

      <div class="flex h-7 w-[164px] items-center gap-1">
        <CalendarClock class="text-muted-foreground size-3.5 shrink-0" />
        <UiInput
          :model-value="due"
          variant="ghost"
          class="h-7 px-1"
          :placeholder="i18n.t('notes.tasks.duePlaceholder')"
          @update:model-value="updateDue"
        />
      </div>
    </div>
  </div>
</template>
