<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useDialog,
  useNoteFolders,
  useNotes,
  useNotesApp,
} from '@/composables'
import { i18n } from '@/electron'
import { scrollToElement } from '@/utils'

const props = defineProps<{
  contextNode: any
  editableId: string | number | null
}>()

const emit = defineEmits<{
  'update:editableId': [value: string | number | null]
}>()

const {
  createNoteFolderAndSelect,
  deleteNoteFolder,
  folders,
  getFolderByIdFromTree,
  getNoteFolders,
  selectedFolderIds,
  clearFolderSelection,
  selectNoteFolder,
} = useNoteFolders()

const { notesState } = useNotesApp()
const { clearNotesState } = useNotes()

const isContextMultiSelection = computed(() => {
  if (!props.contextNode)
    return false
  if (selectedFolderIds.value.length <= 1)
    return false
  return selectedFolderIds.value.includes(props.contextNode.id)
})

async function onDeleteFolder() {
  if (!props.contextNode)
    return

  const { confirm } = useDialog()
  const activeBeforeDelete = notesState.folderId
  const targetIds = selectedFolderIds.value.includes(props.contextNode.id)
    ? [...selectedFolderIds.value]
    : [props.contextNode.id]
  const folderName = getFolderByIdFromTree(
    folders.value,
    props.contextNode.id,
  )?.name

  const isConfirmed = await confirm({
    title:
      targetIds.length > 1
        ? i18n.t('messages:confirm.delete', {
            name: i18n.t('sidebar.folders'),
          })
        : i18n.t('messages:confirm.delete', { name: folderName }),
  })

  if (!isConfirmed)
    return

  await Promise.all(targetIds.map(id => deleteNoteFolder(id, false)))
  await getNoteFolders(false)

  if (activeBeforeDelete && targetIds.includes(activeBeforeDelete)) {
    clearNotesState()
    const fallbackId = selectedFolderIds.value[0]

    if (fallbackId) {
      await selectNoteFolder(fallbackId)
      scrollToElement(`[id="${fallbackId}"]`)
    }
    else {
      clearFolderSelection()
    }
  }
}

function onRenameFolder() {
  setTimeout(() => {
    if (!props.contextNode)
      return
    emit('update:editableId', props.contextNode.id)
  }, 100)
}
</script>

<template>
  <ContextMenu.ContextMenuContent>
    <template v-if="isContextMultiSelection">
      <ContextMenu.ContextMenuItem @click="onDeleteFolder">
        {{ i18n.t("action.delete.common") }}
      </ContextMenu.ContextMenuItem>
    </template>
    <template v-else>
      <ContextMenu.ContextMenuItem
        @click="createNoteFolderAndSelect(contextNode?.id)"
      >
        {{ i18n.t("action.new.folder") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuSeparator />
      <ContextMenu.ContextMenuItem @click="onRenameFolder">
        {{ i18n.t("action.rename") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuItem @click="onDeleteFolder">
        {{ i18n.t("action.delete.common") }}
      </ContextMenu.ContextMenuItem>
    </template>
  </ContextMenu.ContextMenuContent>
</template>
