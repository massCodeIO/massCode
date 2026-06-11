<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  isTaskNote,
  NoteTaskStatus,
  useDialog,
  useDonations,
  useNotes,
  useNotesApp,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n, ipc } from '@/electron'
import { isMac } from '@/utils'
import { useClipboard } from '@vueuse/core'
import { api } from '~/renderer/services/api'

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

const { notesState } = useNotesApp()

const {
  selectFirstNote,
  selectedNoteIds,
  updateNote,
  updateNoteProperties,
  updateNotes,
  deleteSelectedNotes,
} = useNotes()

const { copy } = useClipboard()
const { confirm } = useDialog()

const isFavoritesLibrarySelected = computed(
  () => notesState.libraryFilter === LibraryFilter.Favorites,
)

const isTrashLibrarySelected = computed(
  () => notesState.libraryFilter === LibraryFilter.Trash,
)
const isTask = computed(() => isTaskNote(props.note))

const revealInFileManagerLabel = computed(() =>
  isMac
    ? i18n.t('action.reveal.inFinder')
    : i18n.t('action.reveal.inFileManager'),
)

async function onAddFavorites() {
  const isFavorites = isFavoritesLibrarySelected.value ? 0 : 1

  if (selectedNoteIds.value.length > 1) {
    const notesData = selectedNoteIds.value.map(() => ({ isFavorites }))
    await updateNotes(selectedNoteIds.value, notesData)
  }
  else {
    await updateNote(props.note.id, { isFavorites })
  }

  if (isFavoritesLibrarySelected.value) {
    if (
      selectedNoteIds.value.length > 1
      || notesState.noteId === props.note.id
    ) {
      selectFirstNote()
    }
  }
}

async function onDelete() {
  await deleteSelectedNotes(props.note)
}

async function onRestore() {
  if (selectedNoteIds.value.length > 1) {
    const notesData = selectedNoteIds.value.map(() => ({
      folderId: null,
      isDeleted: 0,
    }))
    await updateNotes(selectedNoteIds.value, notesData)
  }
  else {
    await updateNote(props.note.id, { folderId: null, isDeleted: 0 })
  }
}

function onRevealInFileManager() {
  void ipc.invoke('system:show-note-in-file-manager', props.note.id)
}

function onCopyNoteLink() {
  copy(`masscode://goto?noteId=${props.note.id}`)
}

async function onCopyNoteContent() {
  try {
    // Список не содержит контента — он загружается по id.
    const { data } = await api.notes.getNotesById(String(props.note.id))
    copy(data.content)
    useDonations().incrementCopy('notes')
  }
  catch (error) {
    console.error(error)
  }
}

async function onConvertToTask() {
  await updateNoteProperties(props.note.id, {
    properties: {
      status: NoteTaskStatus.Todo,
      type: 'task',
    },
  })
}

async function onConvertToNote() {
  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.convertTaskToNote', {
      name: props.note.name,
    }),
    content: i18n.t('messages:warning.taskPropertiesRemoved'),
  })

  if (!isConfirmed) {
    return
  }

  await updateNoteProperties(props.note.id, {
    unset: ['type', 'status', 'priority', 'due'],
  })
}
</script>

<template>
  <ContextMenu.ContextMenuContent>
    <template v-if="!isTrashLibrarySelected">
      <ContextMenu.ContextMenuItem @click="onAddFavorites">
        {{
          isFavoritesLibrarySelected
            ? i18n.t("action.remove.fromFavorites")
            : i18n.t("action.add.toFavorites")
        }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuItem
        v-if="!isTask"
        @click="onConvertToTask"
      >
        {{ i18n.t("notes.tasks.convertToTask") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuItem
        v-else
        @click="onConvertToNote"
      >
        {{ i18n.t("notes.tasks.convertToNote") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuSeparator />
    </template>
    <ContextMenu.ContextMenuItem @click="onRevealInFileManager">
      {{ revealInFileManagerLabel }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuItem @click="onCopyNoteContent">
      {{ i18n.t("action.copy.note") }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuItem @click="onCopyNoteLink">
      {{ i18n.t("action.copy.noteLink") }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuSeparator />
    <ContextMenu.ContextMenuItem @click="onDelete">
      {{
        notesState.libraryFilter === LibraryFilter.Trash
          ? i18n.t("action.delete.common")
          : i18n.t("action.move.toTrash")
      }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuItem
      v-if="isTrashLibrarySelected"
      @click="onRestore"
    >
      {{ i18n.t("action.restore") }}
    </ContextMenu.ContextMenuItem>
  </ContextMenu.ContextMenuContent>
</template>
