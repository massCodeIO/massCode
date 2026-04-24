<script setup lang="ts">
import type { DropPosition, TreeNode } from './types'
import { treeInjectionKey } from './keys'
import TreeNodeComponent from './TreeNode.vue'

interface Props {
  modelValue: TreeNode[]
  selectedIds?: (string | number)[]
  editableId?: string | number | null
  focusedId?: string | number | undefined
  highlightedIds?: Set<string | number>
  indent?: number
  getValidationMessage?: (node: TreeNode, value: string) => string
}

interface Emits {
  (e: 'update:modelValue', value: TreeNode[]): void
  (e: 'update:selectedIds', value: (string | number)[]): void
  (e: 'update:editableId', value: string | number | null): void
  (e: 'update:focusedId', value: string | number | undefined): void
  (e: 'update:highlightedIds', value: Set<string | number>): void
  (e: 'clickNode', value: { node: TreeNode, event?: MouseEvent }): void
  (e: 'dblclickNode', value: TreeNode): void
  (e: 'toggleNode', value: TreeNode): void
  (
    e: 'dragNode',
    value: { nodes: TreeNode[], target: TreeNode, position: DropPosition },
  ): void
  (
    e: 'externalDrop',
    value: { data: DataTransfer, target: TreeNode, position: DropPosition },
  ): void
  (e: 'updateLabel', value: { node: TreeNode, value: string }): void
  (e: 'cancelEdit', value: TreeNode): void
  (
    e: 'contextMenu',
    value: { node: TreeNode, selectedNodes: TreeNode[] },
  ): void
}

const props = withDefaults(defineProps<Props>(), {
  selectedIds: () => [],
  editableId: null,
  focusedId: undefined,
  highlightedIds: () => new Set(),
  indent: 10,
})

const emit = defineEmits<Emits>()

const hoveredNodeId = ref('')
const isHoveredByIdDisabled = ref(false)

const internalEditableId = computed({
  get: () => props.editableId,
  set: val => emit('update:editableId', val),
})

const internalSelectedIds = computed({
  get: () => props.selectedIds,
  set: val => emit('update:selectedIds', val),
})

const internalFocusedId = computed({
  get: () => props.focusedId,
  set: val => emit('update:focusedId', val),
})

const internalHighlightedIds = computed({
  get: () => props.highlightedIds,
  set: val => emit('update:highlightedIds', val),
})

function findNodeById(id: string | number): TreeNode | undefined {
  const walk = (nodes: TreeNode[]): TreeNode | undefined => {
    for (const node of nodes) {
      if (node.id === id)
        return node
      if (node.children?.length) {
        const found = walk(node.children)
        if (found)
          return found
      }
    }
  }
  return walk(props.modelValue)
}

function clickNode(id: string | number, event?: MouseEvent) {
  const node = findNodeById(id)
  if (!node)
    return

  emit('clickNode', { node, event })
}

function dblclickNode(node: TreeNode) {
  emit('dblclickNode', node)
}

function dragNodeHandler(
  nodes: TreeNode[],
  target: TreeNode,
  position: DropPosition,
) {
  emit('dragNode', { nodes, target, position })
}

function externalDropHandler(
  data: DataTransfer,
  target: TreeNode,
  position: DropPosition,
) {
  emit('externalDrop', { data, target, position })
}

function toggleNode(node: TreeNode) {
  emit('toggleNode', node)
}

function contextMenu(node: TreeNode) {
  const selectedNodes = internalSelectedIds.value
    .map(id => findNodeById(id))
    .filter((n): n is TreeNode => Boolean(n))

  emit('contextMenu', { node, selectedNodes })
}

function updateLabelHandler(node: TreeNode, value: string) {
  emit('updateLabel', { node, value })
}

function cancelEditHandler(node: TreeNode) {
  emit('cancelEdit', node)
}

provide(treeInjectionKey, {
  clickNode,
  dblclickNode,
  dragNode: dragNodeHandler,
  externalDrop: externalDropHandler,
  toggleNode,
  contextMenu,
  updateLabel: updateLabelHandler,
  cancelEdit: cancelEditHandler,
  getValidationMessage: props.getValidationMessage,
  isHoveredByIdDisabled,
  editableId: internalEditableId,
  selectedIds: internalSelectedIds,
  focusedId: internalFocusedId,
  highlightedIds: internalHighlightedIds,
})
</script>

<template>
  <div
    v-if="modelValue.length"
    class="h-full min-h-0"
  >
    <div class="scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto">
      <div data-tree>
        <TreeNodeComponent
          v-for="(node, index) in modelValue"
          :key="node.id"
          :node="node"
          :nodes="modelValue"
          :index="index"
          :indent="indent"
          :hovered-node-id="hoveredNodeId"
        >
          <template
            v-if="$slots.icon"
            #icon="iconProps"
          >
            <slot
              name="icon"
              v-bind="iconProps"
            />
          </template>
        </TreeNodeComponent>
      </div>
    </div>
  </div>
</template>
