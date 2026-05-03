<script setup lang="ts">
import CustomIcons from '@/components/sidebar/folders/custom-icons/CustomIcons.vue'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useDialog, useHttpFolders, useHttpRequests } from '@/composables'
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
  createHttpFolderAndSelect,
  deleteHttpFolder,
  folders,
  getFolderByIdFromTree,
  getHttpFolders,
  updateHttpFolder,
  selectedFolderIds,
  clearFolderSelection,
  selectHttpFolder,
} = useHttpFolders()
const { createHttpRequestAndSelect } = useHttpRequests()

const isContextMultiSelection = computed(() => {
  if (!props.contextNode)
    return false
  if (selectedFolderIds.value.length <= 1)
    return false
  return selectedFolderIds.value.includes(props.contextNode.id)
})

async function onCreateChildRequest() {
  if (!props.contextNode)
    return
  await createHttpRequestAndSelect({ folderId: props.contextNode.id })
}

async function onDeleteFolder() {
  if (!props.contextNode)
    return

  const { confirm } = useDialog()
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
            name: i18n.t('common.folders'),
          })
        : i18n.t('messages:confirm.delete', { name: folderName }),
  })

  if (!isConfirmed)
    return

  await Promise.all(targetIds.map(id => deleteHttpFolder(id, false)))
  await getHttpFolders(false)

  const fallbackId = selectedFolderIds.value[0]
  if (fallbackId) {
    await selectHttpFolder(fallbackId)
    scrollToElement(`[id="${fallbackId}"]`)
  }
  else {
    clearFolderSelection()
  }
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
        await updateHttpFolder(nodeId, { icon: iconName })
        await getHttpFolders(false)
      },
    }),
  })
}

async function onRemoveCustomIcon() {
  if (!props.contextNode)
    return

  await updateHttpFolder(props.contextNode.id, { icon: null })
  await getHttpFolders(false)
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
      <ContextMenu.ContextMenuItem @click="onCreateChildRequest">
        {{ i18n.t("spaces.http.action.newRequest") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuItem
        @click="createHttpFolderAndSelect(contextNode?.id)"
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
