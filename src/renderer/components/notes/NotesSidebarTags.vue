<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useDialog,
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNoteTags,
} from '@/composables'
import { i18n } from '@/electron'

const { tags, deleteNoteTag } = useNoteTags()
const { highlightedTagId, notesState } = useNotesApp()
const {
  getNotes,
  selectFirstNote,
  clearNotes,
  withNotesLoading,
  clearSearch,
  isRestoreStateBlocked,
} = useNotes()
const { clearFolderSelection } = useNoteFolders()

const idToDelete = ref(0)

async function onTagClick(tagId: number) {
  await withNotesLoading(async () => {
    notesState.tagId = tagId
    clearFolderSelection()
    notesState.libraryFilter = undefined

    isRestoreStateBlocked.value = true
    clearSearch()

    await getNotes({ tagId })
    selectFirstNote()
  })
}

function onClickContextMenu(tagId: number) {
  highlightedTagId.value = tagId
  idToDelete.value = tagId
}

async function onDelete() {
  const { confirm } = useDialog()

  const name = tags.value.find(
    tag => tag.id === highlightedTagId.value,
  )?.name

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.delete', { name }),
    content: i18n.t('messages:warning.deleteTag'),
  })

  if (isConfirmed && idToDelete.value) {
    await deleteNoteTag(idToDelete.value)

    if (notesState.tagId === idToDelete.value) {
      notesState.tagId = undefined
      clearNotes()
    }
    else if (notesState.tagId) {
      await getNotes({ tagId: notesState.tagId })
    }

    idToDelete.value = 0
  }
}

function onUpdateContextMenu(isOpen: boolean) {
  if (!isOpen) {
    highlightedTagId.value = undefined
  }
}
</script>

<template>
  <div
    v-if="tags.length"
    data-notes-sidebar-tags
    class="h-full min-h-0"
  >
    <div class="scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto">
      <ContextMenu.ContextMenu @update:open="onUpdateContextMenu">
        <ContextMenu.ContextMenuTrigger>
          <NotesSidebarTagItem
            v-for="tag in tags"
            :id="tag.id"
            :key="tag.id"
            :name="tag.name"
            @click="onTagClick(tag.id)"
            @contextmenu="onClickContextMenu(tag.id)"
          />
        </ContextMenu.ContextMenuTrigger>
        <ContextMenu.ContextMenuContent>
          <ContextMenu.ContextMenuItem @click="onDelete">
            {{ i18n.t("action.delete.common") }}
          </ContextMenu.ContextMenuItem>
        </ContextMenu.ContextMenuContent>
      </ContextMenu.ContextMenu>
    </div>
  </div>
  <UiEmptyPlaceholder
    v-else
    :text="i18n.t('placeholder.emptyNotesTagList')"
  />
</template>
