<template>
  <div
    class="node"
    :class="{
      'has-children': hasChildren,
      'is-dragged': isDragged
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
      :id="node.id"
      ref="rowRef"
      class="node__row"
      :class="{
        'is-hovered': (isHovered && isAllowed) || hoveredNodeId === node.id,
        'is-selected': isSelected,
        'is-focused': isFocused,
        'is-highlighted': isHighlighted
      }"
      @dragenter.stop="onDragEnter"
      @dragover="onDragOver"
      @click="onClickNode(node.id)"
    >
      <span class="node__name">
        <UniconsAngleRight
          v-if="node.children.length"
          class="node__arrow"
          :class="{ 'node__arrow--down': node.isOpen }"
          @click.stop="onClickArrow(node.id)"
        />
        <span
          v-else
          class="node__arrow-placeholder"
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
      <AppTreeNode
        v-for="(children, idx) in node.children"
        v-show="node.isOpen"
        :key="children.id"
        class="children"
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
      </AppTreeNode>
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

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import type { CSSProperties, Ref } from 'vue'
import { computed, inject, ref } from 'vue'
import {
  store,
  isAllowed,
  insertNodeByPosition,
  pushNode,
  toggleNode
} from './composable'
import type { Node, Position } from './types'

interface Props {
  index: number
  deep?: number
  node: Node
  nodes: Node[]
  indent?: number
  hoveredNodeId?: string
  ghostEl?: Function
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  deep: 0,
  indent: 10,
  deepArray: () => [0]
})

const updateValue = inject('updateValue') as Function
const clickNode = inject('clickNode') as Function
const contextMenuHandler = inject('contextMenuHandler') as Function
const isHoveredByIdDisabled = inject('isHoveredByIdDisabled') as Ref

const hoveredId = ref()
const overPosition = ref<Position>()
const isDragged = ref(false)
const isFocused = ref(false)
const isHighlighted = ref(false)
const rowRef = ref<HTMLElement>()

// COMPUTED
const hasChildren = computed(() => props.node.children.length > 0)

const isFirst = computed(() => props.index === 0)

const isHovered = computed(() => {
  return props.node.id === hoveredId.value && overPosition.value === 'center'
})

const isSelected = computed(() => store.selectedId === props.node.id)

const isShowBetweenLine = computed(() => {
  if (!store.dragNode) return false
  return overPosition.value === 'before' || overPosition.value === 'after'
})

const indentStyle = computed(() => {
  return props.indent + 'px'
})

const hoveredOffsetStyle = computed(() => {
  return -(props.deep * props.indent) + 'px'
})

const betweenLineStyle = computed(() => {
  const style: CSSProperties = {
    position: 'absolute',
    width: `calc(100% - ${props.deep} * ${indentStyle.value})`
  }

  if (overPosition.value === 'before') {
    style.top = '-6px'
  }

  if (overPosition.value === 'after') {
    style.bottom = '-6px'
  }

  return style
})

// METHODS
const onClickArrow = (id: string) => {
  toggleNode(id)
  updateValue()
}

const onClickNode = (id: string) => {
  store.selectedId = id
  isFocused.value = true
  clickNode(id)
}

const onClickContextMenu = async () => {
  isHighlighted.value = true
  isHighlighted.value = await contextMenuHandler()
}

const onDragStart = (e: DragEvent) => {
  store.dragNode = props.node
  isHoveredByIdDisabled.value = true

  const el = document.createElement('div')
  const style = {
    position: 'fixed',
    left: '-100%',
    color: 'var(--color-text)',
    fontSize: 'var(--text-md)'
  }

  el.id = 'ghost'
  el.innerHTML = props.node.name

  Object.assign(el.style, style)
  document.body.appendChild(el)

  e.dataTransfer!.setDragImage(el, 0, 0)
  setTimeout(() => el.remove(), 0)

  e.dataTransfer!.setData('node', JSON.stringify(props.node))
}

const onDragEnd = () => {
  store.dragNode = undefined
  store.dragEnterNode = undefined
  overPosition.value = undefined
  isDragged.value = false
  isHoveredByIdDisabled.value = false
}

const onDragEnter = () => {
  hoveredId.value = props.node.id
  store.dragEnterNode = props.node
}

const onDragOver = (e: DragEvent) => {
  hoveredId.value = props.node.id

  if (props.node?.id === store.dragNode?.id) return

  const height = rowRef.value!.offsetHeight
  const before = height * 0.3
  const after = height - before

  if (e.offsetY < before && isFirst.value) {
    overPosition.value = 'before'
  } else if (e.offsetY > after) {
    overPosition.value = 'after'
  } else {
    overPosition.value = 'center'
  }
}

const onDragLeave = (e: DragEvent) => {
  (e.target as HTMLElement).style.background = ''
  hoveredId.value = undefined
  overPosition.value = undefined
}

const onDrop = () => {
  if (overPosition.value === 'after') {
    insertNodeByPosition('after', props.node, store.dragNode!)
    updateValue()
  }

  if (overPosition.value === 'before') {
    insertNodeByPosition('before', props.node, store.dragNode!)
    updateValue()
  }

  if (overPosition.value === 'center') {
    pushNode(props.node, store.dragNode!)
    updateValue()
  }

  overPosition.value = undefined
}

onClickOutside(rowRef, () => {
  isFocused.value = false
  isHighlighted.value = false
})
</script>

<style lang="scss" scoped>
$color-blue: #0063e1;
$color-grey: #8c8c8c;
.node {
  $r: &;
  position: relative;
  user-select: none;
  + .node {
    margin-top: 2px;
  }
  &__row {
    user-select: none;
    position: relative;
    display: flex;
    &.is-hovered,
    &.is-selected,
    &.is-focused,
    &.is-highlighted {
      color: #fff;
      position: relative;
      #{$r}__arrow {
        fill: #fff;
      }
      &::before {
        content: '';
        left: v-bind(hoveredOffsetStyle);
        right: 0;
        top: 0;
        bottom: 0;
        position: absolute;
        background-color: var(--color-primary);
        z-index: 0;
        border-radius: 5px;
      }
    }
    &.is-selected {
      #{$r}__arrow {
        fill: var(--color-text);
      }
      color: var(--color-text);
      &::before {
        background-color: var(--color-sidebar-item-selected);
      }
      :deep(svg) {
        fill: var(--color-text);
      }
    }
    &.is-focused,
    &.is-hovered {
      color: #fff;
      #{$r}__arrow {
        fill: #fff;
      }
      :deep(svg) {
        fill: #fff !important;
      }
      &::before {
        background-color: var(--color-primary);
      }
    }
    &.is-highlighted {
      color: var(--color-text);
      &::before {
        background-color: transparent;
        border: 2px solid var(--color-primary);
      }
      :deep(svg) {
        fill: var(--color-text) !important;
      }
      &.is-focused {
        :deep(svg) {
          fill: var(--color-text);
        }
      }
      &.is-selected {
        :deep(svg) {
          fill: var(--color-text) !important;
        }
      }
    }
  }
  &__name {
    display: flex;
    align-items: center;
    position: relative;
    z-index: 1;
    width: 100%;
  }
  .children {
    padding-left: 10px;
    padding-left: v-bind(indentStyle);
  }
  &__arrow {
    position: relative;
    color: $color-grey;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 19px;
    height: 19px;
    fill: $color-grey;
    z-index: 1;
    &-placeholder {
      width: 19px;
    }
    &--down {
      transform: rotate(90deg);
    }
  }
}
</style>
