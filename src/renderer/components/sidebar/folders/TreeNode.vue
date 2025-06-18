<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Node, Position } from './types'
import { useApp, useFolders, useSnippets } from '@/composables'
import { onClickOutside } from '@vueuse/core'
import { ChevronRight, Folder } from 'lucide-vue-next'
import { isAllowed, store } from './composables'
import { treeKeys } from './keys'

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

const {
  clickNode,
  dragNode,
  toggleNode,
  isHoveredByIdDisabled,
  focusHandler,
  contextMenu,
} = inject(treeKeys)!

const {
  highlightedFolderId,
  highlightedSnippetIds,
  highlightedTagId,
  state,
  focusedFolderId,
} = useApp()
const { displayedSnippets, updateSnippets, selectFirstSnippet } = useSnippets()
const { updateFolder, renameFolderId } = useFolders()

const hoveredId = ref()
const overPosition = ref<Position>()
const isDragged = ref(false)

const rowRef = ref<HTMLElement>()

const name = ref(props.node.name)

const hasChildren = computed(
  () => props.node.children && props.node.children.length > 0,
)

const isFirst = computed(() => props.index === 0)

const isHovered = computed(() => {
  return props.node.id === hoveredId.value && overPosition.value === 'center'
})

const isSelected = computed(() => state.folderId === props.node.id)

const isHighlighted = computed(
  () => highlightedFolderId.value === props.node.id,
)
const isFocused = computed(() => focusedFolderId.value === props.node.id)

const isShowBetweenLine = computed(() => {
  if (!isAllowed.value)
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
  highlightedFolderId.value = undefined
  highlightedTagId.value = undefined
  state.tagId = undefined
  focusedFolderId.value = Number(id)
  clickNode(Number(id))
}

function onClickContextMenu(e: MouseEvent) {
  highlightedFolderId.value = props.node.id
  highlightedSnippetIds.value.clear()
  contextMenu(props.node, e)
}

function onDragStart(e: DragEvent) {
  store.dragNode = props.node
  isHoveredByIdDisabled.value = true

  const el = document.createElement('div')
  el.className = 'fixed left-[-100%] text-fg'

  el.id = 'ghost'
  el.innerHTML = props.node.name

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

async function onDrop(e: DragEvent) {
  const snippetIds = JSON.parse(e.dataTransfer?.getData('snippetIds') || '[]')
  const snippets = displayedSnippets.value?.filter(s =>
    snippetIds.includes(s.id),
  )

  if (snippets && snippets.length > 0) {
    // Если все сниппеты уже в папке и не удалены
    if (snippets.every(s => s.folder?.id === props.node.id && !s.isDeleted)) {
      return
    }

    const ids = snippets.map(s => s.id)
    const data = snippets.map(() => ({
      folderId: props.node.id,
      // Если сниппет был удален, восстанавливаем его
      isDeleted: 0,
    }))

    await updateSnippets(ids, data)

    if (state.snippetId && ids.includes(state.snippetId)) {
      selectFirstSnippet()
    }
  }

  if (!store.dragNode || !isAllowed.value)
    return

  if (overPosition.value) {
    dragNode(store.dragNode, props.node, overPosition.value)
  }

  overPosition.value = undefined
}

onClickOutside(rowRef, () => {
  focusedFolderId.value = undefined
  highlightedFolderId.value = undefined
})

function onUpdateName() {
  const trimmedName = name.value.trim()

  if (trimmedName === '' || name.value === props.node.name) {
    name.value = props.node.name
    renameFolderId.value = null
    return
  }

  updateFolder(props.node.id, { name: name.value })

  renameFolderId.value = null
}

function onCancelUpdateName() {
  name.value = props.node.name
  renameFolderId.value = null
}

if (focusHandler)
  focusHandler(isFocused)
</script>

<template>
  <div
    data-folder-tree-node
    class="node user-select-none relative *:mt-[2px]"
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
      class="node__row user-select-none relative flex"
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
      <span class="node__name relative z-10 flex w-full items-center">
        <div
          v-if="node.children && node.children.length"
          class="mx-1 flex h-4 w-4 flex-shrink-0 items-center justify-center"
          @click.stop="onClickArrow(node)"
        >
          <ChevronRight
            class="node__arrow h-3 w-3"
            :class="{ 'rotate-90': node.isOpen }"
          />
        </div>
        <span
          v-else
          class="w-6 flex-shrink-0"
        />
        <slot
          :node="node"
          :deep="deep"
        >
          <div class="mr-1.5 flex flex-shrink-0 items-center">
            <UiFolderIcon
              v-if="node.icon"
              :name="node.icon"
            />
            <Folder
              v-else
              class="h-4 w-4"
            />
          </div>
          <span
            v-if="renameFolderId !== node.id"
            class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            @dblclick="renameFolderId = node.id"
          >
            {{ name }}
          </span>
          <UiInput
            v-else
            v-model="name"
            variant="ghost"
            focus
            select
            class="w-full rounded-none px-0 py-0 leading-0"
            @keydown.esc="onCancelUpdateName"
            @keydown.enter="onUpdateName"
            @blur="onUpdateName"
            @click.stop
          />
        </slot>
      </span>
    </div>
    <template v-if="node.children">
      <TreeNode
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
      </TreeNode>
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
      @apply text-list-selection-fg;
      &::before {
        content: "";
        left: v-bind(hoveredOffsetStyle);
        @apply bg-list-focus absolute top-0 right-0 bottom-0 z-0 rounded-md;
      }
    }
    &.is-selected {
      @apply text-list-selection-fg;
      &::before {
        @apply bg-list-selection;
      }
    }
    &.is-focused,
    &.is-hovered {
      @apply text-list-focus-fg;
      &::before {
        @apply bg-list-focus;
      }
    }
    &.is-highlighted {
      @apply text-list-selection-fg;
      &::before {
        @apply border-list-focus border-2 bg-transparent;
      }
    }
  }
  .children {
    padding-left: v-bind(indentStyle);
  }
}
</style>
