<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Node, Position } from './types'
import { onClickOutside } from '@vueuse/core'
import { ChevronRight } from 'lucide-vue-next'

import { isAllowed, store } from './composables'

import { folderTreeKeys } from './keys'

interface Props {
  index: number
  deep?: number
  node: Node
  nodes: Node[]
  indent?: number
  hoveredNodeId?: string
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  deep: 0,
  indent: 10,
})

const { clickNode, dragNode, toggleNode, isHoveredByIdDisabled, focusHandler }
  = inject(folderTreeKeys)!

const hoveredId = ref()
const overPosition = ref<Position>()
const isDragged = ref(false)
const isFocused = ref(false)

const rowRef = ref<HTMLElement>()

const hasChildren = computed(
  () => props.node.children && props.node.children.length > 0,
)

const isFirst = computed(() => props.index === 0)

const isHovered = computed(() => {
  return props.node.id === hoveredId.value && overPosition.value === 'center'
})

const isSelected = computed(() => store.selectedId === props.node.id)
const isHighlighted = computed(() => store.highlightedId === props.node.id)

const isShowBetweenLine = computed(() => {
  if (!store.dragNode)
    return false
  return overPosition.value === 'before' || overPosition.value === 'after'
})

const indentStyle = computed(() => {
  return `${props.indent}px`
})

const hoveredOffsetStyle = computed(() => {
  return `${-(props.deep * props.indent)}px`
})

const betweenLineStyle = computed(() => {
  const style: CSSProperties = {
    position: 'absolute',
    width: `calc(100% - ${props.deep} * ${indentStyle.value})`,
  }

  if (overPosition.value === 'before') {
    style.top = '-6px'
  }

  if (overPosition.value === 'after') {
    style.bottom = '-6px'
  }

  return style
})

function onClickArrow(node: Node) {
  toggleNode(node)
}

function onClickNode(id: string | number) {
  store.selectedId = id
  store.highlightedId = undefined
  isFocused.value = true
  clickNode(id)
}

async function onClickContextMenu() {
  store.highlightedId = props.node.id
}

function onDragStart(e: DragEvent) {
  store.dragNode = props.node
  isHoveredByIdDisabled.value = true

  const el = document.createElement('div')
  const style = {
    position: 'fixed',
    left: '-100%',
    color: 'var(--color-text)',
    fontSize: 'var(--text-md)',
  }

  el.id = 'ghost'
  el.innerHTML = props.node.name

  Object.assign(el.style, style)
  document.body.appendChild(el)

  e.dataTransfer!.setDragImage(el, 0, 0)
  setTimeout(() => el.remove(), 0)

  e.dataTransfer!.setData('node', JSON.stringify(props.node))
}

function onDragEnd() {
  store.dragNode = undefined
  store.dragEnterNode = undefined
  overPosition.value = undefined
  isDragged.value = false
  isHoveredByIdDisabled.value = false
}

function onDragEnter() {
  hoveredId.value = props.node.id
  store.dragEnterNode = props.node
}

function onDragOver(e: DragEvent) {
  hoveredId.value = props.node.id

  if (props.node?.id === store.dragNode?.id)
    return

  const height = rowRef.value!.offsetHeight
  const before = height * 0.3
  const after = height - before

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

function onDragLeave() {
  hoveredId.value = undefined
  overPosition.value = undefined
}

function onDrop() {
  if (!store.dragNode || !isAllowed.value)
    return

  if (overPosition.value) {
    dragNode(store.dragNode, props.node, overPosition.value)
  }

  overPosition.value = undefined
}

onClickOutside(rowRef, () => {
  isFocused.value = false
  // isHighlighted.value = false
  store.highlightedId = undefined
})

if (focusHandler)
  focusHandler(isFocused)
</script>

<template>
  <div
    data-folder-tree-node
    class="node *:mt-[2px] relative user-select-none"
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
    @contextmenu.stop="onClickContextMenu"
  >
    <div
      :id="String(node.id)"
      ref="rowRef"
      class="node__row relative flex user-select-none"
      :class="{
        'is-hovered':
          (isHovered && isAllowed) || hoveredNodeId === String(node.id),
        'is-selected': isSelected,
        'is-focused': isFocused,
        'is-highlighted': isHighlighted,
      }"
      @dragenter.stop="onDragEnter"
      @dragover="onDragOver"
      @click="onClickNode(node.id)"
    >
      <span class="node__name flex items-center relative z-10 w-full">
        <div
          v-if="node.children && node.children.length"
          class="w-4 h-4 mx-1 flex items-center justify-center"
          @click.stop="onClickArrow(node)"
        >
          <ChevronRight
            class="node__arrow w-3 h-3"
            :class="{ 'rotate-90': node.isOpen }"
          />
        </div>
        <span
          v-else
          class="w-6"
        />
        <slot
          :node="node"
          :deep="deep"
        >
          {{ node.name }}
        </slot>
      </span>
    </div>
    <template v-if="node.children">
      <FolderTreeNode
        v-for="(children, idx) in node.children"
        v-show="node.isOpen"
        :key="children.id"
        class="children pl-2"
        :index="idx"
        :deep="deep + 1"
        :node="children"
        :nodes="node.children"
        :hovered-node-id="hoveredNodeId"
      >
        <template #default="scoped: any">
          <slot
            :node="scoped.node"
            :deep="scoped.deep"
            :hovered-node-id="hoveredNodeId"
          />
        </template>
      </FolderTreeNode>
    </template>
    <svg
      v-if="isShowBetweenLine"
      height="10"
      :style="betweenLineStyle"
    >
      <circle
        cx="5"
        cy="5"
        r="3"
        stroke="var(--color-primary)"
        fill="none"
        stroke-width="2"
      />
      <line
        x1="100%"
        x2="8"
        y1="5"
        y2="5"
        stroke="var(--color-primary)"
        stroke-width="2"
      />
    </svg>
  </div>
</template>

<style lang="scss">
@reference "../../../styles.css";
.node {
  $r: &;
  &__row {
    &.is-hovered,
    &.is-selected,
    &.is-focused,
    &.is-highlighted {
      @apply text-white;
      &::before {
        content: "";
        left: v-bind(hoveredOffsetStyle);
        @apply absolute right-0 top-0 bottom-0 bg-primary z-0 rounded-md;
      }
    }
    &.is-selected {
      @apply text-fg;
      &::before {
        @apply bg-black/10;
      }
    }
    &.is-focused,
    &.is-hovered {
      @apply text-white;
      &::before {
        @apply bg-primary;
      }
    }
    &.is-highlighted {
      @apply text-fg;
      &::before {
        @apply bg-transparent border-2 border-primary;
      }
    }
  }
  .children {
    padding-left: v-bind(indentStyle);
  }
}
</style>
