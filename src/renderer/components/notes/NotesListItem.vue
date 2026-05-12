<script setup lang="ts">
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  createTaskCompletionPatch,
  getTaskDue,
  getTaskStatus,
  isTaskNote,
  NoteTaskStatus,
  useApp,
  useNavigationHistory,
  useNotes,
  useNotesApp,
} from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format, isPast, isToday, isValid, parseISO } from 'date-fns'

interface NoteTagInfo {
  id: number
  name: string
}

interface NoteFolderInfo {
  id: number
  name: string
}

interface NoteRecord {
  id: number
  name: string
  description: string | null
  content: string
  properties: Record<string, unknown>
  tags: NoteTagInfo[]
  folder: NoteFolderInfo | null
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

interface Props {
  note: NoteRecord
}

const props = defineProps<Props>()

const { isCompactListMode } = useApp()
const { clearHistory } = useNavigationHistory()
const { highlightedNoteIds, highlightedFolderIds, focusedNoteId, notesState }
  = useNotesApp()

const { selectNote, selectedNoteIds, updateNoteProperties } = useNotes()

const noteRef = ref<HTMLDivElement>()

const isSelected = computed(() => notesState.noteId === props.note.id)

const isInMultiSelection = computed(
  () =>
    selectedNoteIds.value.length > 1
    && selectedNoteIds.value.includes(props.note.id),
)
const isHighlighted = computed(() =>
  highlightedNoteIds.value.has(props.note.id),
)

const isFocused = computed(() => focusedNoteId.value === props.note.id)

const folderName = computed(() => {
  if (props.note.folder) {
    return props.note.folder.name
  }

  if (props.note.isDeleted) {
    return i18n.t('common.trash')
  }

  return i18n.t('common.inbox')
})

const isTask = computed(() => isTaskNote(props.note))
const taskStatus = computed(() => getTaskStatus(props.note))
const isTaskDone = computed(() => taskStatus.value === NoteTaskStatus.Done)
const taskDue = computed(() => getTaskDue(props.note))
const taskDueLabel = computed(() => {
  if (!taskDue.value) {
    return ''
  }

  const due = parseISO(taskDue.value)
  if (!isValid(due)) {
    return taskDue.value
  }

  if (isToday(due)) {
    return i18n.t('notes.tasks.today')
  }

  return format(due, 'dd.MM.yyyy')
})
const isTaskOverdue = computed(() => {
  if (!taskDue.value || isTaskDone.value) {
    return false
  }

  const due = parseISO(taskDue.value)
  return isValid(due) && isPast(due) && !isToday(due)
})
const trailingMeta = computed(() => {
  if (isTask.value && taskDueLabel.value) {
    return taskDueLabel.value
  }

  return format(new Date(props.note.updatedAt), 'dd.MM.yyyy')
})

function onNoteClick(id: number, event: MouseEvent) {
  clearHistory()
  selectNote(id, event.shiftKey)
  focusedNoteId.value = id
}

function onClickContextMenu() {
  highlightedFolderIds.value.clear()
  highlightedNoteIds.value.clear()
  highlightedNoteIds.value.add(props.note.id)

  if (selectedNoteIds.value.length > 1) {
    selectedNoteIds.value.forEach(id => highlightedNoteIds.value.add(id))
  }
}

async function onTaskDoneChange() {
  if (!isTask.value) {
    return
  }

  await updateNoteProperties(
    props.note.id,
    createTaskCompletionPatch(props.note),
  )
}

function onDragStart(event: DragEvent) {
  const ids
    = selectedNoteIds.value.length > 1 ? selectedNoteIds.value : [props.note.id]

  event.dataTransfer?.setData('noteIds', JSON.stringify(ids))

  const el = document.createElement('div')

  if (selectedNoteIds.value.length > 1) {
    el.className
      = 'fixed left-[-100%] text-foreground truncate max-w-[200px] flex items-center'
    el.id = 'ghost'
    el.innerHTML = `
      <span class="rounded-full bg-primary text-white px-2 py-0.5 text-xs ml-3">
        ${selectedNoteIds.value.length}
      </span>
    `
  }
  else {
    el.className = 'fixed left-[-100%] text-foreground truncate max-w-[200px]'
    el.id = 'ghost'
    el.innerHTML = props.note.name
  }

  document.body.appendChild(el)
  event.dataTransfer?.setDragImage(el, 0, 0)

  setTimeout(() => el.remove(), 0)
}

onClickOutside(noteRef, () => {
  focusedNoteId.value = undefined
  highlightedNoteIds.value.clear()
})
</script>

<template>
  <div
    ref="noteRef"
    data-note-item
    class="border-border relative border-b px-1 focus-visible:outline-none"
    :class="{
      'is-selected': isSelected,
      'is-multi-selected': isInMultiSelection,
      'is-focused': isFocused,
      'is-highlighted': isHighlighted,
    }"
    draggable="true"
    @click="(event) => onNoteClick(note.id, event)"
    @contextmenu="onClickContextMenu"
    @dragstart.stop="onDragStart"
  >
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger>
        <div
          class="select-none"
          :class="
            isCompactListMode
              ? 'flex items-center gap-2 px-2 py-1.5'
              : 'flex flex-col p-2'
          "
        >
          <div
            class="flex min-w-0 items-center gap-2 overflow-hidden"
            :class="isCompactListMode ? 'flex-1' : 'mb-2'"
          >
            <Checkbox
              v-if="isTask"
              :model-value="isTaskDone"
              class="mt-px"
              @click.stop
              @update:model-value="onTaskDoneChange"
            />
            <span
              class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
              :class="{ 'text-muted-foreground line-through': isTaskDone }"
            >
              {{ note.name || i18n.t("notes.untitled") }}
            </span>
          </div>
          <UiText
            v-if="isCompactListMode"
            as="div"
            variant="xs"
            muted
            class="meta shrink-0"
            :class="{ 'text-destructive!': isTaskOverdue }"
          >
            {{ trailingMeta }}
          </UiText>
          <UiText
            v-else
            as="div"
            variant="xs"
            muted
            class="meta flex justify-between"
          >
            <div>
              {{ folderName }}
            </div>
            <div :class="{ 'text-destructive!': isTaskOverdue }">
              {{ trailingMeta }}
            </div>
          </UiText>
        </div>
      </ContextMenu.ContextMenuTrigger>
      <NotesListItemContextMenu :note="note" />
    </ContextMenu.ContextMenu>
  </div>
</template>

<style lang="scss">
@reference "../../styles.css";
[data-note-item] {
  &:not(.is-selected):not(.is-focused):not(.is-multi-selected) {
    @apply hover:bg-accent-hover hover:rounded-md;
  }
  &.is-selected {
    @apply bg-accent text-accent-foreground z-10 rounded-md border-transparent;
    .meta {
      @apply text-accent-foreground;
    }
  }
  &.is-multi-selected {
    @apply bg-accent text-accent-foreground z-10 rounded-md border-transparent;
    .meta {
      @apply text-accent-foreground;
    }
  }
  &.is-focused:not(.is-multi-selected) {
    @apply bg-primary text-primary-foreground z-10 rounded-md border-transparent;
    .meta {
      @apply text-primary-foreground;
    }
  }
  &.is-highlighted {
    @apply outline-primary rounded-md outline-2 -outline-offset-2;
    &.is-focused,
    &.is-selected,
    &.is-multi-selected {
      @apply bg-background text-accent-foreground;
      .meta {
        @apply text-accent-foreground;
      }
    }
  }
}
</style>
