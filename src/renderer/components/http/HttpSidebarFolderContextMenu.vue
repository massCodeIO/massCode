<script setup lang="ts">
import type { FolderIconSetPayload } from '~/main/types/ipc'
import CustomIcons from '@/components/sidebar/folders/custom-icons/CustomIcons.vue'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  markPersistedStorageMutation,
  useDialog,
  useHttpFolders,
  useHttpRequests,
  useSonner,
} from '@/composables'
import { i18n, ipc } from '@/electron'

const props = defineProps<{
  contextNode: any
  editableId: string | number | null
}>()

const emit = defineEmits<{
  'update:editableId': [value: string | number | null]
}>()

const {
  createHttpFolderAndSelect,
  deleteSelectedHttpFolders,
  getHttpFolders,
  selectedFolderIds,
} = useHttpFolders()
const { createHttpRequestAndSelect } = useHttpRequests()
const { sonner } = useSonner()

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

  await deleteSelectedHttpFolders(props.contextNode.id)
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
      onIconChanged: () => getHttpFolders(false),
      spaceId: 'http',
    }),
  })
}

async function onRemoveCustomIcon() {
  if (!props.contextNode)
    return

  try {
    await ipc.invoke<FolderIconSetPayload, void>('fs:folder-icon:set', {
      folderId: Number(props.contextNode.id),
      icon: null,
      spaceId: 'http',
    })
    markPersistedStorageMutation()
    await getHttpFolders(false)
  }
  catch {
    sonner({
      message: i18n.t('folder.iconPicker.errors.updateFailed'),
      type: 'error',
    })
  }
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
