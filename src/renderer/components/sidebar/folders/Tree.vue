<script setup lang="ts">
import type { Ref } from 'vue'
import type { Node } from './types'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDialog, useFolders, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { treeKeys } from './keys'
import TreeNode from './TreeNode.vue'

interface Props {
  modelValue: Node[]
  selectedId?: string | number
  contextMenuHandler?: () => Promise<boolean>
  focusHandler?: (isFocused: Ref) => void
}

interface Emits {
  (e: 'update:modelValue', value: Node[]): void
  (e: 'clickNode', value: number): void
  (e: 'dragNode', value: { node: Node, target: Node, position: string }): void
  (e: 'toggleNode', value: Node): void
}

const props = withDefaults(defineProps<Props>(), {
  contextMenuHandler: () => Promise.resolve(true),
})

const emit = defineEmits<Emits>()

const { createFolderAndSelect, deleteFolder, renameFolderId, folders }
  = useFolders()
const { selectedFolderId } = useApp()
const { clearSnippetsState } = useSnippets()

const contextMenuTriggerRef = useTemplateRef('contextMenuTriggerRef')
const hoveredNodeId = ref('')
const isHoveredByIdDisabled = ref(false)
const contextNodeId = ref<number | null>(null)

function clickNode(id: number) {
  return emit('clickNode', id)
}

function dragNode(node: Node, target: Node, position: string) {
  return emit('dragNode', { node, target, position })
}

function toggleNode(node: Node) {
  return emit('toggleNode', node)
}

/**
 * Поскольку в TreeNode есть @contextmenu.stop, то для того чтобы
 * предотвратить высплытие в родительский узел для корректной подсветки,
 * используем программную отправку события contextmenu.
 * Так же такое решение избавит от n кол-ва ContextMenu на каждый узел.
 */
function contextMenu(node: Node, event: MouseEvent) {
  contextNodeId.value = node.id
  contextMenuTriggerRef.value?.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: false,
      clientX: event.clientX,
      clientY: event.clientY,
    }),
  )
}

async function onDeleteFolder() {
  const { confirm } = useDialog()

  const folderName = folders.value?.find(
    folder => folder.id === contextNodeId.value,
  )?.name

  const isConfirmed = await confirm({
    title: i18n.t('dialog:deleteConfirm', { name: folderName }),
    description: i18n.t('dialog:allSnippetsMoveToTrash'),
  })

  if (isConfirmed && contextNodeId.value) {
    deleteFolder(contextNodeId.value)

    if (contextNodeId.value === selectedFolderId.value) {
      selectedFolderId.value = undefined
      clearSnippetsState()
    }
  }
}

function onRenameFolder() {
  // FIXME: Костыль для того чтобы input в TreeNode фокусировался,
  // разобраться почему не работает nextTick
  setTimeout(() => {
    renameFolderId.value = contextNodeId.value
  }, 100)
}

provide(treeKeys, {
  clickNode,
  contextMenu,
  dragNode,
  focusHandler: props.focusHandler,
  isHoveredByIdDisabled,
  toggleNode,
})
</script>

<template>
  <ContextMenu.Root>
    <ContextMenu.Trigger as-child>
      <div
        ref="contextMenuTriggerRef"
        data-folder-tree
        class="pt-1"
      >
        <TreeNode
          v-for="(node, index) in modelValue"
          :key="node.id"
          :node="node"
          :nodes="modelValue"
          :index="index"
          :hovered-node-id="hoveredNodeId"
        >
          <template #default="slotProps">
            <slot
              v-if="slotProps && slotProps.node"
              :node="slotProps.node"
              :deep="slotProps.deep"
              :hovered-node-id="hoveredNodeId"
            />
            <template v-else>
              {{ node.name }} s
            </template>
          </template>
        </TreeNode>
      </div>
    </ContextMenu.Trigger>
    <ContextMenu.Content>
      <ContextMenu.Item @click="createFolderAndSelect">
        {{ i18n.t("newFolder") }}
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item @click="onRenameFolder">
        {{ i18n.t("rename") }}
      </ContextMenu.Item>
      <ContextMenu.Item @click="onDeleteFolder">
        {{ i18n.t("delete") }}
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>
</template>
