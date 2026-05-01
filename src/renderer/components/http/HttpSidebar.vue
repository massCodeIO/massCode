<script setup lang="ts">
import type { TreeNode as TreeNodeType } from '@/components/ui/tree/types'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { Tree as UiTree } from '@/components/ui/tree'
import {
  useHttpApp,
  useHttpFolderDragDrop,
  useHttpFolders,
} from '@/composables'
import { i18n } from '@/electron'
import {
  getEntryNameConflictMessage,
  getEntryNameValidationMessage,
} from '@/utils'
import { Folder, Plus } from 'lucide-vue-next'

const { highlightedFolderIds, highlightedRequestIds, focusedFolderId }
  = useHttpApp()
const {
  createHttpFolderAndSelect,
  folders,
  updateHttpFolder,
  getFolderByIdFromTree,
  selectedFolderIds,
  selectHttpFolder,
} = useHttpFolders()
const { onDragNode, onExternalDrop } = useHttpFolderDragDrop()

function mapToTreeNode(folder: any): TreeNodeType {
  return {
    id: folder.id,
    label: folder.name,
    isExpanded: Boolean(folder.isOpen),
    children: folder.children?.map(mapToTreeNode) || [],
  }
}

const treeData = computed(() => folders.value?.map(mapToTreeNode) || [])

const selectedIds = computed({
  get: () => selectedFolderIds.value as (string | number)[],
  set: (val) => {
    selectedFolderIds.value = val as number[]
  },
})

const editableId = ref<string | number | null>(null)

const focusedId = computed({
  get: () => focusedFolderId.value as string | number | undefined,
  set: (val) => {
    focusedFolderId.value = val as number | undefined
  },
})

const highlightedIds = computed({
  get: () => highlightedFolderIds.value as Set<string | number>,
  set: (val) => {
    highlightedFolderIds.value.clear()
    val.forEach(id => highlightedFolderIds.value.add(id as number))
  },
})

const contextNode = ref<any>(null)

function flattenFolders(nodes: any[], acc: any[] = []): any[] {
  for (const folder of nodes) {
    acc.push(folder)
    if (folder.children?.length) {
      flattenFolders(folder.children, acc)
    }
  }
  return acc
}

function hasSiblingFolderConflict(node: TreeNodeType, value: string): boolean {
  const folderId = Number(node.id)
  const folder = getFolderByIdFromTree(folders.value, folderId)
  if (!folder)
    return false

  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === folder.name.toLowerCase())
    return false

  const parentId = folder.parentId ?? null
  return flattenFolders(folders.value || []).some(
    sibling =>
      sibling.id !== folderId
      && (sibling.parentId ?? null) === parentId
      && sibling.name.toLowerCase() === normalized,
  )
}

function getFolderValidationMessage(node: TreeNodeType, value: string) {
  const message = getEntryNameValidationMessage(value, i18n.t.bind(i18n))
  if (message)
    return message

  if (hasSiblingFolderConflict(node, value)) {
    return getEntryNameConflictMessage('folder', i18n.t.bind(i18n))
  }

  return ''
}

async function onClickNode({
  node,
  event,
}: {
  node: TreeNodeType
  event?: MouseEvent
}) {
  highlightedFolderIds.value.clear()

  const id = Number(node.id)

  if (event?.shiftKey) {
    await selectHttpFolder(id, { mode: 'range', ensureVisibility: false })
    return
  }

  if (event && (event.metaKey || event.ctrlKey)) {
    await selectHttpFolder(id, { mode: 'toggle', ensureVisibility: false })
    return
  }

  await selectHttpFolder(id)
}

function onDblclickNode(node: TreeNodeType) {
  setTimeout(() => {
    editableId.value = node.id
  }, 100)
}

function onToggleNode(node: TreeNodeType) {
  const folderNode = getFolderByIdFromTree(folders.value, Number(node.id))
  if (folderNode) {
    updateHttpFolder(Number(node.id), {
      isOpen: !folderNode.isOpen ? 1 : 0,
    })
  }
}

function onContextMenu({
  node,
}: {
  node: TreeNodeType
  selectedNodes: TreeNodeType[]
}) {
  contextNode.value = getFolderByIdFromTree(folders.value, Number(node.id))
  highlightedRequestIds.value.clear()
}

function onUpdateLabel({ node, value }: { node: TreeNodeType, value: string }) {
  updateHttpFolder(Number(node.id), { name: value })
  editableId.value = null
}

function onCancelEdit() {
  editableId.value = null
}
</script>

<template>
  <div
    class="flex h-full flex-col px-1"
    style="
      padding-top: calc(var(--content-top-offset) + var(--header-gap, 0px));
    "
  >
    <SidebarHeader
      :title="i18n.t('spaces.http.title')"
      :section-title="i18n.t('common.folders')"
    >
      <template #action>
        <UiActionButton
          :tooltip="i18n.t('action.new.folder')"
          @click="createHttpFolderAndSelect()"
        >
          <Plus class="h-4 w-4" />
        </UiActionButton>
      </template>
    </SidebarHeader>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <ContextMenu.ContextMenu>
        <ContextMenu.ContextMenuTrigger as-child>
          <UiTree
            v-if="treeData.length"
            :model-value="treeData"
            :selected-ids="selectedIds"
            :editable-id="editableId"
            :focused-id="focusedId"
            :highlighted-ids="highlightedIds"
            :get-validation-message="getFolderValidationMessage"
            class="h-full px-0.5 pb-1"
            @click-node="onClickNode"
            @dblclick-node="onDblclickNode"
            @toggle-node="onToggleNode"
            @drag-node="onDragNode"
            @external-drop="onExternalDrop"
            @context-menu="onContextMenu"
            @update-label="onUpdateLabel"
            @cancel-edit="onCancelEdit"
            @update:selected-ids="selectedIds = $event"
            @update:editable-id="editableId = $event"
            @update:focused-id="focusedId = $event"
            @update:highlighted-ids="highlightedIds = $event"
          >
            <template #icon>
              <div class="mr-1.5 flex flex-shrink-0 items-center">
                <Folder class="h-4 w-4" />
              </div>
            </template>
          </UiTree>
        </ContextMenu.ContextMenuTrigger>
        <UiEmptyPlaceholder
          v-if="!treeData.length"
          :text="i18n.t('placeholder.emptyFoldersList')"
        />
        <HttpSidebarFolderContextMenu
          :context-node="contextNode"
          :editable-id="editableId"
          @update:editable-id="editableId = $event"
        />
      </ContextMenu.ContextMenu>
    </div>
  </div>
</template>
