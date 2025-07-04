<script setup lang="ts">
import type { Ref } from 'vue'
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import type { Node } from './types'
import { languages } from '@/components/editor/grammars/languages'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDialog, useFolders, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { scrollToElement } from '@/utils'
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

const {
  createFolderAndSelect,
  deleteFolder,
  renameFolderId,
  folders,
  updateFolder,
  getFolderByIdFromTree,
} = useFolders()
const { state } = useApp()
const { clearSnippetsState } = useSnippets()

const contextMenuTriggerRef = useTemplateRef('contextMenuTriggerRef')
const scrollRef = useTemplateRef<PerfectScrollbarExpose>('scrollRef')

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

  const folderName = getFolderByIdFromTree(
    folders.value,
    contextNodeId.value,
  )?.name

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.delete', { name: folderName }),
    description: i18n.t('messages:warning:allSnippetsMoveToTrash'),
  })

  if (isConfirmed && contextNodeId.value) {
    await deleteFolder(contextNodeId.value)

    if (contextNodeId.value === state.folderId) {
      state.folderId = undefined
      clearSnippetsState()

      const firstFolder = folders.value?.[0]

      if (firstFolder) {
        state.folderId = firstFolder.id
        scrollToElement(`[id="${state.folderId}"]`)
      }
    }

    nextTick(() => {
      if (scrollRef.value) {
        scrollRef.value.ps?.update()
      }
    })
  }
}

function onRenameFolder() {
  // FIXME: Костыль для того чтобы input в TreeNode фокусировался,
  // разобраться почему не работает nextTick
  setTimeout(() => {
    renameFolderId.value = contextNodeId.value
  }, 100)
}

function onSelectLanguage(language: string) {
  if (!contextNodeId.value) {
    return
  }

  updateFolder(contextNodeId.value, {
    defaultLanguage: language,
  })
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
    :options="{ minScrollbarLength: 20 }"
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
        <ContextMenu.Item @click="createFolderAndSelect">
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
      </ContextMenu.Content>
    </ContextMenu.Root>
  </PerfectScrollbar>
</template>
