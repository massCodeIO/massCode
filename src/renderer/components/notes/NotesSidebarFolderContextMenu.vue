<script setup lang="ts">
import CustomIcons from '@/components/sidebar/folders/custom-icons/CustomIcons.vue'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useDialog, useNoteFolders } from '@/composables'
import { i18n, ipc } from '@/electron'
import { isMac } from '@/utils'

const props = defineProps<{
  contextNode: any
  editableId: string | number | null
}>()

const emit = defineEmits<{
  'update:editableId': [value: string | number | null]
}>()

const {
  createNoteFolderAndSelect,
  deleteSelectedNoteFolders,
  getNoteFolders,
  updateNoteFolder,
  selectedFolderIds,
} = useNoteFolders()

const isContextMultiSelection = computed(() => {
  if (!props.contextNode)
    return false
  if (selectedFolderIds.value.length <= 1)
    return false
  return selectedFolderIds.value.includes(props.contextNode.id)
})

const revealInFileManagerLabel = computed(() =>
  isMac
    ? i18n.t('action.reveal.inFinder')
    : i18n.t('action.reveal.inFileManager'),
)

async function onDeleteFolder() {
  if (!props.contextNode)
    return

  await deleteSelectedNoteFolders(props.contextNode.id)
}

function onRenameFolder() {
  setTimeout(() => {
    if (!props.contextNode)
      return
    emit('update:editableId', props.contextNode.id)
  }, 100)
}

function onSetCustomIcon() {
  if (!props.contextNode)
    return

  const { showDialog } = useDialog()

  showDialog({
    title: i18n.t('action.setCustomIcon'),
    content: h(CustomIcons, {
      nodeId: props.contextNode.id,
      onSetIcon: async (nodeId: number, iconName: string) => {
        await updateNoteFolder(nodeId, { icon: iconName })
        await getNoteFolders(false)
      },
    }),
  })
}

async function onRemoveCustomIcon() {
  if (!props.contextNode)
    return

  await updateNoteFolder(props.contextNode.id, { icon: null })
  await getNoteFolders(false)
}

function onRevealInFileManager() {
  if (!props.contextNode) {
    return
  }

  void ipc.invoke(
    'system:show-notes-folder-in-file-manager',
    Number(props.contextNode.id),
  )
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
      <ContextMenu.ContextMenuItem @click="onRevealInFileManager">
        {{ revealInFileManagerLabel }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuSeparator />
      <ContextMenu.ContextMenuItem @click="onDeleteFolder">
        {{ i18n.t("action.delete.common") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuSeparator />
      <ContextMenu.ContextMenuItem @click="onSetCustomIcon">
        {{ i18n.t("action.setCustomIcon") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuItem
        v-if="contextNode?.icon"
        @click="onRemoveCustomIcon"
      >
        {{ i18n.t("action.removeCustomIcon") }}
      </ContextMenu.ContextMenuItem>
    </template>
  </ContextMenu.ContextMenuContent>
</template>
