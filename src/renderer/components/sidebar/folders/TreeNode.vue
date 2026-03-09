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
  highlightedFolderIds,
  highlightedSnippetIds,
  highlightedTagId,
  state,
  focusedFolderId,
} = useApp()
const { displayedSnippets, updateSnippets, selectFirstSnippet } = useSnippets()
const {
  updateFolder,
  renameFolderId,
  selectedFolderIds,
  folders,
  getFolderByIdFromTree,
} = useFolders()

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
const isMultiSelected = computed(
  () =>
    selectedFolderIds.value.length > 1
    && selectedFolderIds.value.includes(props.node.id),
)

const isHighlighted = computed(() =>
  highlightedFolderIds.value.has(props.node.id),
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

function getNodeById(id: number) {
  return getFolderByIdFromTree(folders.value, id) as Node | undefined
}

function hasSelectedAncestor(node: Node, selection: Set<number>) {
  let parentId = node.parentId

  while (parentId) {
    if (selection.has(parentId)) {
      return true
    }

    parentId = getNodeById(parentId)?.parentId || null
  }

  return false
}

function getDraggedNodes() {
  const selection = selectedFolderIds.value.includes(Number(props.node.id))
    ? selectedFolderIds.value
    : [Number(props.node.id)]

  const selectionSet = new Set(selection)

  return selection
    .map(id => getNodeById(Number(id)))
    .filter((node): node is Node => Boolean(node))
    .filter(node => !hasSelectedAncestor(node, selectionSet))
}

function onClickArrow(node: Node) {
  toggleNode(node)
}

function onClickNode(id: string | number, event?: MouseEvent) {
  highlightedFolderIds.value.clear()
  highlightedTagId.value = undefined
  state.tagId = undefined
  focusedFolderId.value = Number(id)
  clickNode(Number(id), event)
}

function onClickContextMenu(e: MouseEvent) {
  highlightedFolderIds.value.clear()
  highlightedFolderIds.value.add(Number(props.node.id))

  if (
    selectedFolderIds.value.length > 1
    && selectedFolderIds.value.includes(Number(props.node.id))
  ) {
    selectedFolderIds.value.forEach(folderId =>
      highlightedFolderIds.value.add(Number(folderId)),
    )
  }

  highlightedSnippetIds.value.clear()
  contextMenu(props.node, e)
}

function onDragStart(e: DragEvent) {
  let draggedNodes = getDraggedNodes()

  if (!draggedNodes.length) {
    draggedNodes = [props.node]
  }

  const isMultiFolderDrag
    = selectedFolderIds.value.length > 1
      && selectedFolderIds.value.includes(Number(props.node.id))
  const ghostCount = isMultiFolderDrag
    ? selectedFolderIds.value.length
    : draggedNodes.length

  store.dragNodes = draggedNodes
  store.dragNode = draggedNodes[0] || props.node
  isHoveredByIdDisabled.value = true
  isDragged.value = true

  const el = document.createElement('div')
  el.className
    = 'fixed left-[-100%] text-fg truncate max-w-[200px] flex items-center'

  el.id = 'ghost'
  el.innerHTML
    = ghostCount > 1
      ? `
        <span class="rounded-full bg-primary text-white px-2 py-0.5 text-xs ml-3">
          ${ghostCount}
        </span>
      `
      : props.node.name

  document.body.appendChild(el)

  e.dataTransfer!.setDragImage(el, 0, 0)
  setTimeout(() => el.remove(), 0)

  e.dataTransfer!.setData(
    'folderIds',
    JSON.stringify(draggedNodes.map(node => node.id)),
  )
}

function onDragEnd() {
  store.dragNode = undefined
  store.dragNodes = undefined
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

  const isDraggingNode
    = store.dragNodes?.some(node => node.id === props.node.id)
      || store.dragNode?.id === props.node.id

  if (isDraggingNode)
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

  const draggedNodes = store.dragNodes?.length
    ? store.dragNodes
    : store.dragNode
      ? [store.dragNode]
      : []

  if (overPosition.value && draggedNodes.length) {
    dragNode(draggedNodes, props.node, overPosition.value)
  }

  overPosition.value = undefined
}

onClickOutside(rowRef, () => {
  focusedFolderId.value = undefined
  highlightedFolderIds.value.clear()
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
        'is-multi-selected': isMultiSelected,
        'is-focused': isFocused,
        'is-highlighted': isHighlighted,
      }"
      @dragenter.stop="onDragEnter"
      @dragover="onDragOver"
      @click="(event) => onClickNode(node.id, event)"
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
    &.is-highlighted,
    &.is-multi-selected {
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
    &.is-multi-selected {
      @apply text-list-selection-fg;
      &::before {
        @apply bg-list-selection/80;
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
