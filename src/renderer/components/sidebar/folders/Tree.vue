<script setup lang="ts">
import type { TreeNode as TreeNodeType } from '@/components/ui/tree/types'
import type { Node, Position } from './types'
import { languages } from '@/components/editor/grammars/languages'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { Tree as UiTree } from '@/components/ui/tree'
import { useApp, useDialog, useFolders, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { scrollToElement } from '@/utils'
import { Folder } from 'lucide-vue-next'
import CustomIcons from './custom-icons/CustomIcons.vue'

interface Props {
  modelValue: Node[]
  selectedId?: string | number
}

interface Emits {
  (e: 'update:modelValue', value: Node[]): void
  (e: 'clickNode', value: { id: number, event?: MouseEvent }): void
  (
    e: 'dragNode',
    value: { nodes: Node[], target: Node, position: Position },
  ): void
  (e: 'toggleNode', value: Node): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const {
  createFolderAndSelect,
  deleteFolder,
  folders,
  updateFolder,
  getFolderByIdFromTree,
  getFolders,
  selectedFolderIds,
  clearFolderSelection,
  selectFolder,
} = useFolders()
const {
  state,
  highlightedFolderIds,
  highlightedSnippetIds,
  highlightedTagId,
  focusedFolderId,
} = useApp()
const {
  clearSnippetsState,
  displayedSnippets,
  updateSnippets,
  selectFirstSnippet,
} = useSnippets()

// --- Data mapping ---

function mapToTreeNode(folder: Node): TreeNodeType {
  return {
    id: folder.id,
    label: folder.name,
    isExpanded: Boolean(folder.isOpen),
    children: folder.children?.map(mapToTreeNode) || [],
  }
}

const treeData = computed(() => props.modelValue.map(mapToTreeNode))

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

// --- Context menu state ---

const contextNode = ref<Node | null>(null)

const isContextMultiSelection = computed(() => {
  if (!contextNode.value)
    return false
  if (selectedFolderIds.value.length <= 1)
    return false
  return selectedFolderIds.value.includes(contextNode.value.id)
})

const contextNodeDefaultLanguage = computed(() => {
  if (!contextNode.value)
    return ''
  return (
    getFolderByIdFromTree(folders.value, contextNode.value.id)
      ?.defaultLanguage || ''
  )
})

// --- Event handlers ---

function onClickNode({
  node,
  event,
}: {
  node: TreeNodeType
  event?: MouseEvent
}) {
  highlightedFolderIds.value.clear()
  highlightedTagId.value = undefined
  state.tagId = undefined
  emit('clickNode', { id: Number(node.id), event })
}

function onDblclickNode(node: TreeNodeType) {
  setTimeout(() => {
    editableId.value = node.id
  }, 100)
}

function onToggleNode(node: TreeNodeType) {
  const folderNode = getFolderByIdFromTree(
    folders.value,
    Number(node.id),
  ) as Node
  if (folderNode) {
    emit('toggleNode', folderNode)
  }
}

function onDragNode({
  nodes,
  target,
  position,
}: {
  nodes: TreeNodeType[]
  target: TreeNodeType
  position: Position
}) {
  const folderNodes = nodes
    .map(n => getFolderByIdFromTree(folders.value, Number(n.id)))
    .filter((n): n is Node => Boolean(n))
  const folderTarget = getFolderByIdFromTree(
    folders.value,
    Number(target.id),
  ) as Node

  if (folderNodes.length && folderTarget) {
    emit('dragNode', { nodes: folderNodes, target: folderTarget, position })
  }
}

async function onExternalDrop({
  data,
  target,
}: {
  data: DataTransfer
  target: TreeNodeType
  position: Position
}) {
  const snippetIds = JSON.parse(data.getData('snippetIds') || '[]')
  const snippets = displayedSnippets.value?.filter(s =>
    snippetIds.includes(s.id),
  )

  if (!snippets?.length)
    return

  const folderId = Number(target.id)

  if (snippets.every(s => s.folder?.id === folderId && !s.isDeleted))
    return

  const ids = snippets.map(s => s.id)
  const updateData = snippets.map(() => ({
    folderId,
    isDeleted: 0,
  }))

  await updateSnippets(ids, updateData)

  if (state.snippetId && ids.includes(state.snippetId)) {
    selectFirstSnippet()
  }
}

function onContextMenu({
  node,
}: {
  node: TreeNodeType
  selectedNodes: TreeNodeType[]
}) {
  contextNode.value = getFolderByIdFromTree(
    folders.value,
    Number(node.id),
  ) as Node
  highlightedSnippetIds.value.clear()
}

function onUpdateLabel({ node, value }: { node: TreeNodeType, value: string }) {
  updateFolder(Number(node.id), { name: value })
  editableId.value = null
}

function onCancelEdit() {
  editableId.value = null
}

// --- Context menu actions ---

async function onDeleteFolder() {
  if (!contextNode.value)
    return

  const { confirm } = useDialog()
  const activeBeforeDelete = state.folderId
  const targetIds = selectedFolderIds.value.includes(contextNode.value.id)
    ? [...selectedFolderIds.value]
    : [contextNode.value.id]
  const folderName = getFolderByIdFromTree(
    folders.value,
    contextNode.value.id,
  )?.name

  const isConfirmed = await confirm({
    title:
      targetIds.length > 1
        ? i18n.t('messages:confirm.delete', {
            name: i18n.t('sidebar.folders'),
          })
        : i18n.t('messages:confirm.delete', { name: folderName }),
    description: i18n.t('messages:warning:allSnippetsMoveToTrash'),
  })

  if (!isConfirmed)
    return

  await Promise.all(targetIds.map(id => deleteFolder(id, false)))
  await getFolders(false)

  if (activeBeforeDelete && targetIds.includes(activeBeforeDelete)) {
    clearSnippetsState()
    const fallbackId = selectedFolderIds.value[0]

    if (fallbackId) {
      await selectFolder(fallbackId)
      scrollToElement(`[id="${fallbackId}"]`)
    }
    else {
      clearFolderSelection()
    }
  }
}

function onRenameFolder() {
  setTimeout(() => {
    if (!contextNode.value)
      return
    editableId.value = contextNode.value.id
  }, 100)
}

function onSelectLanguage(language: string) {
  if (!contextNode.value)
    return
  updateFolder(contextNode.value.id, { defaultLanguage: language })
}

function scrollToSelectedLanguage(el: any, isSelected: boolean) {
  if (isSelected && el) {
    nextTick(() => {
      const element = el.$el || el
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ block: 'center' })
      }
    })
  }
}

function onSetCustomIcon() {
  if (!contextNode.value)
    return

  const { showDialog } = useDialog()

  showDialog({
    title: i18n.t('action.setCustomIcon'),
    content: h(CustomIcons, {
      nodeId: contextNode.value.id,
    }),
  })
}

async function onRemoveCustomIcon() {
  if (!contextNode.value)
    return

  updateFolder(contextNode.value.id, { icon: null })
  await getFolders()
}
</script>

<template>
  <ContextMenu.ContextMenu>
    <ContextMenu.ContextMenuTrigger as-child>
      <UiTree
        :model-value="treeData"
        :selected-ids="selectedIds"
        :editable-id="editableId"
        :focused-id="focusedId"
        :highlighted-ids="highlightedIds"
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
        <template #icon="{ node }">
          <div class="mr-1.5 flex flex-shrink-0 items-center">
            <UiFolderIcon
              v-if="getFolderByIdFromTree(folders, Number(node.id))?.icon"
              :name="getFolderByIdFromTree(folders, Number(node.id))!.icon!"
            />
            <Folder
              v-else
              class="h-4 w-4"
            />
          </div>
        </template>
      </UiTree>
    </ContextMenu.ContextMenuTrigger>
    <ContextMenu.ContextMenuContent>
      <template v-if="isContextMultiSelection">
        <ContextMenu.ContextMenuItem @click="onDeleteFolder">
          {{ i18n.t("action.delete.common") }}
        </ContextMenu.ContextMenuItem>
      </template>
      <template v-else>
        <ContextMenu.ContextMenuItem
          @click="createFolderAndSelect(contextNode?.id)"
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
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuSub>
          <ContextMenu.ContextMenuSubTrigger>
            {{ i18n.t("action.defaultLanguage") }}
          </ContextMenu.ContextMenuSubTrigger>
          <ContextMenu.ContextMenuSubContent>
            <div class="scrollbar max-h-[250px] min-h-0 overflow-y-auto">
              <ContextMenu.ContextMenuCheckboxItem
                v-for="language in languages"
                :key="language.value"
                :ref="
                  (el) =>
                    scrollToSelectedLanguage(
                      el,
                      contextNodeDefaultLanguage === language.value,
                    )
                "
                :checked="contextNodeDefaultLanguage === language.value"
                @click="onSelectLanguage(language.value)"
              >
                {{ language.name }}
              </ContextMenu.ContextMenuCheckboxItem>
            </div>
          </ContextMenu.ContextMenuSubContent>
        </ContextMenu.ContextMenuSub>
      </template>
    </ContextMenu.ContextMenuContent>
  </ContextMenu.ContextMenu>
</template>
