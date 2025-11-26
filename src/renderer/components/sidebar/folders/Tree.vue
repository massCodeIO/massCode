<script setup lang="ts">
import type { Ref } from 'vue'
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import type { Node, Position } from './types'
import { languages } from '@/components/editor/grammars/languages'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDialog, useFolders, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { scrollToElement } from '@/utils'
import CustomIcons from './custom-icons/CustomIcons.vue'
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
  (e: 'clickNode', value: { id: number, event?: MouseEvent }): void
  (
    e: 'dragNode',
    value: { nodes: Node[], target: Node, position: Position },
  ): void
  (e: 'toggleNode', value: Node): void
}

const props = withDefaults(defineProps<Props>(), {
  contextMenuHandler: () => Promise.resolve(true),
})

const emit = defineEmits<Emits>()

const {
  createFolderAndSelect,
  deleteFolder,
  renameFolderId,
  folders,
  updateFolder,
  getFolderByIdFromTree,
  getFolders,
  selectedFolderIds,
  clearFolderSelection,
  selectFolder,
} = useFolders()
const { state } = useApp()
const { clearSnippetsState } = useSnippets()

const contextMenuTriggerRef = useTemplateRef('contextMenuTriggerRef')
const scrollRef = useTemplateRef<PerfectScrollbarExpose>('scrollRef')

const hoveredNodeId = ref('')
const isHoveredByIdDisabled = ref(false)
const contextNode = ref<Node | null>(null)
const isContextMultiSelection = computed(() => {
  if (!contextNode.value)
    return false

  if (selectedFolderIds.value.length <= 1)
    return false

  return selectedFolderIds.value.includes(contextNode.value.id)
})

function clickNode(id: number, event?: MouseEvent) {
  return emit('clickNode', { id, event })
}

function dragNode(nodes: Node[], target: Node, position: Position) {
  return emit('dragNode', { nodes, target, position })
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
  contextNode.value = node
  contextMenuTriggerRef.value?.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: false,
      clientX: event.clientX,
      clientY: event.clientY,
    }),
  )
}

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

  nextTick(() => {
    scrollRef.value?.ps?.update()
  })
}

function onRenameFolder() {
  // FIXME: Костыль для того чтобы input в TreeNode фокусировался,
  // разобраться почему не работает nextTick
  setTimeout(() => {
    if (!contextNode.value)
      return

    renameFolderId.value = contextNode.value.id
  }, 100)
}

function onSelectLanguage(language: string) {
  if (!contextNode.value) {
    return
  }

  updateFolder(contextNode.value.id, {
    defaultLanguage: language,
  })
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

  updateFolder(contextNode.value.id, {
    icon: null,
  })

  await getFolders()
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
  <PerfectScrollbar
    v-if="modelValue.length"
    ref="scrollRef"
    :options="{ minScrollbarLength: 20, suppressScrollX: true }"
  >
    <ContextMenu.Root>
      <ContextMenu.Trigger as-child>
        <div
          ref="contextMenuTriggerRef"
          data-folder-tree
          v-bind="$attrs"
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
        <template v-if="isContextMultiSelection">
          <ContextMenu.Item @click="onDeleteFolder">
            {{ i18n.t("action.delete.common") }}
          </ContextMenu.Item>
        </template>
        <template v-else>
          <ContextMenu.Item @click="createFolderAndSelect(contextNode?.id)">
            {{ i18n.t("action.new.folder") }}
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item @click="onRenameFolder">
            {{ i18n.t("action.rename") }}
          </ContextMenu.Item>
          <ContextMenu.Item @click="onDeleteFolder">
            {{ i18n.t("action.delete.common") }}
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item @click="onSetCustomIcon">
            {{ i18n.t("action.setCustomIcon") }}
          </ContextMenu.Item>
          <ContextMenu.Item
            v-if="contextNode?.icon"
            @click="onRemoveCustomIcon"
          >
            {{ i18n.t("action.removeCustomIcon") }}
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger>
              {{ i18n.t("action.defaultLanguage") }}
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent>
              <PerfectScrollbar :options="{ minScrollbarLength: 20 }">
                <div class="max-h-[250px]">
                  <ContextMenu.Item
                    v-for="language in languages"
                    :key="language.value"
                    @click="onSelectLanguage(language.value)"
                  >
                    {{ language.name }}
                  </ContextMenu.Item>
                </div>
              </PerfectScrollbar>
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
        </template>
      </ContextMenu.Content>
    </ContextMenu.Root>
  </PerfectScrollbar>
</template>
