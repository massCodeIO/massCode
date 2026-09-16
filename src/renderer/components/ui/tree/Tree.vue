<script setup lang="ts">
import type { DropPosition, TreeNode } from './types'
import { onClickOutside, useVirtualList } from '@vueuse/core'
import { treeInjectionKey } from './keys'
import TreeNodeComponent from './TreeNode.vue'
import {
  clampScrollTop,
  flattenTree,
  nearestScrollTop,
  pinnedRows,
  TREE_ROW_HEIGHT,
} from './virtualRows'

const props = withDefaults(defineProps<Props>(), {
  selectedIds: () => [],
  editableId: null,
  focusedId: undefined,
  highlightedIds: () => new Set(),
  indent: 10,
  virtual: false,
})

const emit = defineEmits<Emits>()

defineSlots<{ icon?: (props: { node: TreeNode }) => unknown }>()

interface Props {
  modelValue: TreeNode[]
  selectedIds?: (string | number)[]
  editableId?: string | number | null
  focusedId?: string | number | undefined
  highlightedIds?: Set<string | number>
  indent?: number
  virtual?: boolean
  getValidationMessage?: (node: TreeNode, value: string) => string
  canDrop?: (
    nodes: TreeNode[],
    target: TreeNode,
    position: DropPosition,
  ) => boolean
  canDrag?: (node: TreeNode) => boolean
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

const treeRef = ref<HTMLElement>()
const dragSourceId = ref<string | number>()
const flatRows = computed(() =>
  props.virtual ? flattenTree(props.modelValue) : [],
)
const rowsById = computed(
  () => new Map(flatRows.value.map(row => [row.node.id, row])),
)
const { list: windowRows, containerProps } = useVirtualList(flatRows, {
  itemHeight: TREE_ROW_HEIGHT,
  overscan: 8,
})
const containerRef = containerProps.ref
const renderedRows = computed(() =>
  pinnedRows(
    windowRows.value.map(item => item.data),
    rowsById.value,
    [props.editableId, dragSourceId.value],
  ),
)
function scrollToId(id: string | number) {
  const row = rowsById.value.get(id)
  const container = containerRef.value
  if (!row || !container)
    return
  container.scrollTop = nearestScrollTop(
    row.offset,
    container.scrollTop,
    container.clientHeight,
  )
  containerProps.onScroll()
}
function clearOffscreenInteraction() {
  if (!props.virtual)
    return
  const renderedIds = new Set(renderedRows.value.map(row => row.node.id))
  if (
    props.focusedId !== undefined
    && rowsById.value.has(props.focusedId)
    && !renderedIds.has(props.focusedId)
  ) {
    internalFocusedId.value = undefined
  }
  for (const id of internalHighlightedIds.value) {
    if (!renderedIds.has(id))
      internalHighlightedIds.value.delete(id)
  }
}
onClickOutside(treeRef, () => {
  if (!props.virtual)
    return
  if (props.focusedId !== undefined && rowsById.value.has(props.focusedId))
    internalFocusedId.value = undefined
  internalHighlightedIds.value.clear()
})
watch(
  flatRows,
  (_rows, previousRows) => {
    if (!props.virtual)
      return
    const container = containerRef.value
    if (container) {
      container.scrollTop = clampScrollTop(
        container.scrollTop,
        flatRows.value.length,
        container.clientHeight,
      )
      containerProps.onScroll()
    }
    if (
      props.focusedId !== undefined
      && !rowsById.value.has(props.focusedId)
      && previousRows.some(row => row.node.id === props.focusedId)
    ) {
      internalFocusedId.value = undefined
    }
    for (const id of internalHighlightedIds.value) {
      if (!rowsById.value.has(id))
        internalHighlightedIds.value.delete(id)
    }
    if (
      dragSourceId.value !== undefined
      && !rowsById.value.has(dragSourceId.value)
    ) {
      dragSourceId.value = undefined
    }
    if (props.editableId != null && !rowsById.value.has(props.editableId))
      internalEditableId.value = null
  },
  { flush: 'post' },
)
watch(
  () => props.editableId,
  (id) => {
    if (props.virtual && id != null)
      nextTick(() => scrollToId(id))
  },
  { flush: 'post', immediate: true },
)
defineExpose({ scrollToId })

provide(treeInjectionKey, {
  dragSourceChanged: (id) => {
    dragSourceId.value = id
  },
  rootNodes: computed(() => props.modelValue),
  clickNode,
  dblclickNode,
  dragNode: dragNodeHandler,
  externalDrop: externalDropHandler,
  toggleNode,
  contextMenu,
  updateLabel: updateLabelHandler,
  cancelEdit: cancelEditHandler,
  getValidationMessage: props.getValidationMessage,
  canDrop: props.canDrop,
  canDrag: props.canDrag,
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
    ref="treeRef"
    class="h-full min-h-0"
    @click.capture="clearOffscreenInteraction"
    @contextmenu.capture="clearOffscreenInteraction"
  >
    <div
      v-if="virtual"
      ref="containerRef"
      class="scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto"
      @scroll="containerProps.onScroll"
    >
      <div
        data-tree
        class="relative"
        :style="{ height: `${flatRows.length * TREE_ROW_HEIGHT}px` }"
      >
        <TreeNodeComponent
          v-for="row in renderedRows"
          :key="row.node.id"
          :node="row.node"
          :nodes="row.siblings"
          :index="row.index"
          :deep="row.depth"
          :indent="indent"
          :render-children="false"
          class="ui-tree-virtual-row"
          :style="{
            position: 'absolute',
            top: `${row.offset * TREE_ROW_HEIGHT}px`,
            left: `${row.depth * indent}px`,
            right: '0',
            height: `${TREE_ROW_HEIGHT}px`,
          }"
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
    <div
      v-else
      class="scrollbar h-full min-h-0 overflow-x-hidden overflow-y-auto"
    >
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

<style>
.ui-tree-virtual-row .ui-tree-node__row {
  height: 23px;
  line-height: 21px;
}
.ui-tree-virtual-row input {
  height: 21px;
  line-height: 21px;
}
</style>
