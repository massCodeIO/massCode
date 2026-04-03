<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useDialog, useNotes, useNotesApp, useNoteSearch } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n, ipc } from '@/electron'
import { isMac } from '@/utils'
import { useClipboard } from '@vueuse/core'

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
  updateNotes,
  deleteNote,
  deleteNotes,
} = useNotes()
const { displayedNotes } = useNoteSearch()

const { confirm } = useDialog()
const { copy } = useClipboard()

const isFavoritesLibrarySelected = computed(
  () => notesState.libraryFilter === LibraryFilter.Favorites,
)

const isTrashLibrarySelected = computed(
  () => notesState.libraryFilter === LibraryFilter.Trash,
)

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
  if (selectedNoteIds.value.length > 1) {
    const isAllSoftDeleted = displayedNotes.value?.every(n => n.isDeleted)

    if (isAllSoftDeleted) {
      const isConfirmed = await confirm({
        title: i18n.t('messages:confirm.deleteConfirmMultipleSnippets', {
          count: selectedNoteIds.value.length,
        }),
        content: i18n.t('messages:warning.noUndo'),
      })

      if (isConfirmed) {
        await deleteNotes(selectedNoteIds.value)
      }
    }
    else {
      const notesData = selectedNoteIds.value.map(() => ({
        folderId: null,
        isDeleted: 1,
      }))
      await updateNotes(selectedNoteIds.value, notesData)
    }
  }
  else if (props.note.isDeleted) {
    const isConfirmed = await confirm({
      title: i18n.t('messages:confirm.deletePermanently', {
        name: props.note.name,
      }),
      content: i18n.t('messages:warning.noUndo'),
    })

    if (isConfirmed) {
      await deleteNote(props.note.id)
    }
  }
  else {
    await updateNote(props.note.id, { folderId: null, isDeleted: 1 })
  }

  if (selectedNoteIds.value.length > 1 || notesState.noteId === props.note.id) {
    selectFirstNote()
  }
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
      <ContextMenu.ContextMenuSeparator />
    </template>
    <ContextMenu.ContextMenuItem @click="onRevealInFileManager">
      {{ revealInFileManagerLabel }}
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
