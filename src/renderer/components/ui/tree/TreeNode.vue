<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { DropPosition, TreeNode } from './types'
import { onClickOutside } from '@vueuse/core'
import { ChevronRight } from 'lucide-vue-next'
import {
  dragNodeChildrenIds,
  dragNodeIds,
  dragStore,
  isDragAllowed,
  TREE_DND_TYPE,
} from './composables'
import { treeInjectionKey } from './keys'

interface Props {
  index: number
  deep?: number
  node: TreeNode
  nodes: TreeNode[]
  indent?: number
  hoveredNodeId?: string
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  deep: 0,
  indent: 10,
})

const {
  clickNode,
  dblclickNode,
  dragNode,
  externalDrop,
  toggleNode,
  isHoveredByIdDisabled,
  contextMenu,
  updateLabel,
  cancelEdit,
  getValidationMessage,
  editableId,
  selectedIds,
  focusedId,
  highlightedIds,
} = inject(treeInjectionKey)!

const hoveredId = ref<string | number>()
const overPosition = ref<DropPosition>()
const isDragged = ref(false)
const isDraggingExternal = ref(false)
const rowRef = ref<HTMLElement>()
const editInputRef = ref<HTMLInputElement>()
const editValue = ref(props.node.label)

const hasChildren = computed(
  () => props.node.children && props.node.children.length > 0,
)

const isFirst = computed(() => props.index === 0)

const isHovered = computed(() => {
  return props.node.id === hoveredId.value && overPosition.value === 'center'
})

const isSelected = computed(() => {
  return (
    selectedIds.value.length <= 1 && selectedIds.value.includes(props.node.id)
  )
})

const isMultiSelected = computed(() => {
  return (
    selectedIds.value.length > 1 && selectedIds.value.includes(props.node.id)
  )
})

const isFocused = computed(() => focusedId.value === props.node.id)

const isHighlighted = computed(() => highlightedIds.value.has(props.node.id))

const isEditing = computed(() => editableId.value === props.node.id)
const validationMessage = computed(() => {
  return getValidationMessage?.(props.node, editValue.value) || ''
})

const isDragActive = computed(() => Boolean(dragStore.dragNode))

const isShowBetweenLine = computed(() => {
  if (!isDragAllowed.value)
    return false
  return overPosition.value === 'before' || overPosition.value === 'after'
})

const indentStyle = computed(() => `${props.indent}px`)

const hoveredOffsetStyle = computed(() => {
  return `${-(props.deep * props.indent)}px`
})

const betweenLineStyle = computed(() => {
  const style: CSSProperties = {
    position: 'absolute',
    width: `calc(100% - ${props.deep} * ${indentStyle.value})`,
  }

  if (overPosition.value === 'before') {
    style.top = '-4px'
  }

  if (overPosition.value === 'after') {
    style.bottom = '-4px'
  }

  return style
})

watch(
  () => props.node.label,
  (newLabel) => {
    editValue.value = newLabel
  },
)

watch(isEditing, (editing) => {
  if (editing) {
    nextTick(() => {
      editInputRef.value?.focus()
      editInputRef.value?.select()
    })
  }
})

onClickOutside(rowRef, () => {
  if (focusedId.value === props.node.id) {
    focusedId.value = undefined
  }
  highlightedIds.value.delete(props.node.id)
})

function onClickArrow(node: TreeNode) {
  toggleNode(node)
}

function onClickNode(id: string | number, event?: MouseEvent) {
  focusedId.value = id
  clickNode(id, event)
}

function onDblclickLabel() {
  dblclickNode(props.node)
}

function onContextMenu() {
  highlightedIds.value.clear()
  highlightedIds.value.add(props.node.id)

  if (
    selectedIds.value.length > 1
    && selectedIds.value.includes(props.node.id)
  ) {
    selectedIds.value.forEach(id => highlightedIds.value.add(id))
  }

  contextMenu(props.node)
}

// --- Drag and Drop ---

function findNodeById(
  nodes: TreeNode[],
  id: string | number,
): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id)
      return node
    if (node.children?.length) {
      const found = findNodeById(node.children, id)
      if (found)
        return found
    }
  }
}

function hasSelectedAncestor(
  nodeId: string | number,
  selection: Set<string | number>,
  rootNodes: TreeNode[],
): boolean {
  const findParentId = (
    nodes: TreeNode[],
    targetId: string | number,
    parentId?: string | number,
  ): string | number | undefined => {
    for (const node of nodes) {
      if (node.id === targetId)
        return parentId
      if (node.children?.length) {
        const found = findParentId(node.children, targetId, node.id)
        if (found !== undefined)
          return found
      }
    }
  }

  let currentParentId = findParentId(rootNodes, nodeId)

  while (currentParentId !== undefined) {
    if (selection.has(currentParentId))
      return true
    currentParentId = findParentId(rootNodes, currentParentId)
  }

  return false
}

function getDraggedNodes(rootNodes: TreeNode[]) {
  const selection = selectedIds.value.includes(props.node.id)
    ? selectedIds.value
    : [props.node.id]

  const selectionSet = new Set(selection)

  return selection
    .map(id => findNodeById(rootNodes, id))
    .filter((node): node is TreeNode => Boolean(node))
    .filter(node => !hasSelectedAncestor(node.id, selectionSet, rootNodes))
}

function onDragStart(e: DragEvent) {
  let draggedNodes = getDraggedNodes(props.nodes)

  if (!draggedNodes.length) {
    draggedNodes = [props.node]
  }

  const isMultiDrag
    = selectedIds.value.length > 1 && selectedIds.value.includes(props.node.id)
  const ghostCount = isMultiDrag
    ? selectedIds.value.length
    : draggedNodes.length

  dragStore.dragNodes = draggedNodes
  dragStore.dragNode = draggedNodes[0] || props.node
  isHoveredByIdDisabled.value = true
  isDragged.value = true

  const el = document.createElement('div')
  el.className
    = 'fixed left-[-100%] text-foreground truncate max-w-[200px] flex items-center'
  el.id = 'ghost'
  el.innerHTML
    = ghostCount > 1
      ? `<span class="rounded-full bg-primary text-white px-2 py-0.5 text-xs ml-3">${ghostCount}</span>`
      : props.node.label

  document.body.appendChild(el)
  e.dataTransfer!.setDragImage(el, 0, 0)
  setTimeout(() => el.remove(), 0)

  e.dataTransfer!.setData(
    TREE_DND_TYPE,
    JSON.stringify(draggedNodes.map(node => node.id)),
  )
}

function onDragEnd() {
  dragStore.dragNode = undefined
  dragStore.dragNodes = undefined
  dragStore.dragEnterNode = undefined
  overPosition.value = undefined
  isDragged.value = false
  isHoveredByIdDisabled.value = false
}

function onDragEnter() {
  hoveredId.value = props.node.id
  dragStore.dragEnterNode = props.node
}

function onDragOver(e: DragEvent) {
  hoveredId.value = props.node.id

  if (!e.dataTransfer?.types.includes(TREE_DND_TYPE)) {
    isDraggingExternal.value = true
    overPosition.value = 'center'
    return
  }

  isDraggingExternal.value = false

  const isInvalidTarget
    = dragStore.dragNodes?.some(node => node.id === props.node.id)
      || dragStore.dragNode?.id === props.node.id
      || dragNodeIds.value.includes(props.node.id)
      || dragNodeChildrenIds.value.includes(props.node.id)

  if (isInvalidTarget) {
    overPosition.value = undefined
    return
  }

  const height = rowRef.value!.offsetHeight
  const before = height * 0.3
  const after = height - before

  const isContainer = props.node.children !== undefined

  if (isContainer) {
    if (e.offsetY < before && isFirst.value) {
      overPosition.value = 'before'
    }
    else if (e.offsetY > after) {
      overPosition.value = 'after'
    }
    else {
      overPosition.value = 'center'
    }
  }
  else {
    if (e.offsetY < height / 2) {
      overPosition.value = isFirst.value ? 'before' : 'after'
    }
    else {
      overPosition.value = 'after'
    }
  }
}

function onDragLeave() {
  hoveredId.value = undefined
  overPosition.value = undefined
  isDraggingExternal.value = false
}

function onDrop(e: DragEvent) {
  if (!e.dataTransfer?.types.includes(TREE_DND_TYPE)) {
    if (e.dataTransfer) {
      externalDrop(e.dataTransfer, props.node, overPosition.value || 'center')
    }
    hoveredId.value = undefined
    overPosition.value = undefined
    isDraggingExternal.value = false
    return
  }

  if (!dragStore.dragNode || !isDragAllowed.value)
    return

  const draggedNodes = dragStore.dragNodes?.length
    ? dragStore.dragNodes
    : dragStore.dragNode
      ? [dragStore.dragNode]
      : []

  if (overPosition.value && draggedNodes.length) {
    dragNode(draggedNodes, props.node, overPosition.value)
  }

  overPosition.value = undefined
}

// --- Inline Edit ---

function submitEdit() {
  const trimmed = editValue.value.trim()

  if (validationMessage.value) {
    return
  }

  if (trimmed === '' || editValue.value === props.node.label) {
    editValue.value = props.node.label
    cancelEdit(props.node)
    return
  }

  updateLabel(props.node, editValue.value)
}

function onBlurEdit() {
  if (validationMessage.value) {
    onCancelEdit()
    return
  }

  submitEdit()
}

function onCancelEdit() {
  editValue.value = props.node.label
  cancelEdit(props.node)
}
</script>

<template>
  <div
    data-tree-node
    class="ui-tree-node user-select-none relative"
    :class="{
      'has-children': hasChildren,
      'is-dragged': isDragged,
    }"
    draggable="true"
    @dragstart.stop="onDragStart"
    @dragleave.stop="onDragLeave"
    @dragend.stop="onDragEnd"
    @drop.stop="onDrop"
    @dragover.prevent
  >
    <div
      :id="String(node.id)"
      ref="rowRef"
      class="ui-tree-node__row user-select-none relative flex py-px"
      :class="{
        'is-hovered':
          (isHovered && isDragAllowed)
          || (isHovered && isDraggingExternal)
          || hoveredNodeId === String(node.id),
        'is-selected': isSelected && !isEditing,
        'is-multi-selected': isMultiSelected && !isEditing,
        'is-focused': isFocused && !isEditing,
        'is-highlighted': isHighlighted && !isEditing,
        'is-drag-active': isDragActive,
        'is-editing': isEditing,
      }"
      @dragenter.stop="onDragEnter"
      @dragover="onDragOver"
      @click="(event) => onClickNode(node.id, event)"
      @contextmenu="onContextMenu"
    >
      <span class="ui-tree-node__name relative z-10 flex w-full items-center">
        <div
          v-if="hasChildren"
          class="mx-1 flex h-4 w-4 flex-shrink-0 items-center justify-center"
          @click.stop="onClickArrow(node)"
        >
          <ChevronRight
            class="ui-tree-node__arrow h-3 w-3"
            :class="{ 'rotate-90': node.isExpanded }"
          />
        </div>
        <span
          v-else
          class="w-6 flex-shrink-0"
        />
        <slot
          name="icon"
          :node="node"
        />
        <template v-if="!isEditing">
          <span
            class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            @dblclick="onDblclickLabel"
          >
            {{ node.label }}
          </span>
        </template>
        <UiInputValidationTooltip
          v-else
          :open="Boolean(validationMessage)"
          :message="validationMessage"
        >
          <input
            ref="editInputRef"
            v-model="editValue"
            class="outline-primary mr-1 min-w-0 flex-1 rounded-sm bg-transparent outline outline-1"
            @keydown.esc="onCancelEdit"
            @keydown.enter="submitEdit"
            @blur="onBlurEdit"
            @click.stop
          >
        </UiInputValidationTooltip>
      </span>
    </div>
    <template v-if="node.children">
      <TreeNode
        v-for="(child, idx) in node.children"
        v-show="node.isExpanded"
        :key="child.id"
        class="children pl-2"
        :index="idx"
        :deep="deep + 1"
        :node="child"
        :nodes="node.children"
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
      </TreeNode>
    </template>
    <svg
      v-if="isShowBetweenLine"
      class="pointer-events-none z-20"
      height="10"
      :style="betweenLineStyle"
    >
      <circle
        cx="5"
        cy="5"
        r="3"
        stroke="var(--primary)"
        fill="none"
        stroke-width="2"
      />
      <line
        x1="100%"
        x2="8"
        y1="5"
        y2="5"
        stroke="var(--primary)"
        stroke-width="2"
      />
    </svg>
  </div>
</template>

<style lang="scss">
@reference "../../../styles.css";
.ui-tree-node {
  $r: &;
  &__row {
    &.is-hovered,
    &.is-selected,
    &.is-focused,
    &.is-highlighted,
    &.is-multi-selected {
      @apply text-accent-foreground;
      &::before {
        content: "";
        left: v-bind(hoveredOffsetStyle);
        @apply absolute top-0 right-0 bottom-0 z-0 rounded-md;
      }
    }
    &:hover:not(.is-selected):not(.is-focused):not(.is-multi-selected):not(
        .is-drag-active
      ):not(.is-editing) {
      @apply text-accent-foreground;
      &::before {
        content: "";
        left: v-bind(hoveredOffsetStyle);
        @apply bg-accent-hover absolute top-0 right-0 bottom-0 z-0 rounded-md;
      }
    }
    &.is-hovered {
      &::before {
        @apply bg-accent-hover;
      }
    }
    &.is-selected {
      &::before {
        @apply bg-accent;
      }
    }
    &.is-multi-selected {
      &::before {
        @apply bg-accent/80;
      }
    }
    &.is-focused {
      @apply text-primary-foreground;
      &::before {
        @apply bg-primary;
      }
    }
    &.is-highlighted {
      @apply text-accent-foreground;
      &::before {
        @apply border-primary border-2 bg-transparent;
      }
    }
  }
  .children {
    padding-left: v-bind(indentStyle);
  }
}
</style>
