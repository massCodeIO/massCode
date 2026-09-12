<script setup lang="ts">
import type { DropPosition, TreeNode } from '@/components/ui/tree/types'
import type { OutlineHeading, OutlineMove } from './outline'
import { i18n } from '@/electron'
import {
  createOutlineMove,
  getActiveHeading,
  getOutline,
  remapCollapsedHeadings,
} from './outline'

interface OutlineNode extends TreeNode {
  heading: OutlineHeading
  content: string
  noteId: number
  children: OutlineNode[]
}
const props = defineProps<{
  noteId: number
  content: string
  cursor: number
  disabled: boolean
  canEdit: boolean
}>()
const emit = defineEmits<{
  reveal: [heading: OutlineHeading]
  move: [move: OutlineMove]
}>()
const headings = computed(() => getOutline(props.content))
const collapsed = ref(new Set<number>())
watch(
  [() => props.noteId, () => props.content],
  ([noteId, content], [previousId, previous]) => {
    collapsed.value
      = noteId === previousId
        ? remapCollapsedHeadings(previous, content, collapsed.value)
        : new Set()
  },
)
const nodes = computed(() => {
  const roots: OutlineNode[] = []
  const byPosition = new Map<number, OutlineNode>()
  for (const heading of headings.value) {
    const node: OutlineNode = {
      id: `outline:${props.noteId}:${heading.from}`,
      label: heading.title || i18n.t('notes.inspector.outline.untitled'),
      heading,
      content: props.content,
      noteId: props.noteId,
      children: [],
      isExpanded: !collapsed.value.has(heading.from),
    }
    byPosition.set(heading.from, node)
    const parent
      = heading.parent === null ? undefined : byPosition.get(heading.parent)
    if (parent)
      parent.children.push(node)
    else roots.push(node)
  }
  return roots
})
const selected = computed(() => {
  const position = getActiveHeading(headings.value, props.cursor)
  return position === undefined ? [] : [`outline:${props.noteId}:${position}`]
})
function toggleNode(node: TreeNode) {
  const position = (node as OutlineNode).heading.from
  if (collapsed.value.has(position))
    collapsed.value.delete(position)
  else collapsed.value.add(position)
}
function getMove(
  sources: TreeNode[],
  target: TreeNode,
  position: DropPosition,
): OutlineMove | undefined {
  const source = sources[0] as OutlineNode | undefined
  const destination = target as OutlineNode
  if (
    props.disabled
    || !props.canEdit
    || sources.length !== 1
    || !source?.heading
    || source.noteId !== props.noteId
    || source.content !== props.content
  ) {
    return
  }
  return {
    content: source.content,
    from: source.heading.from,
    target: destination.heading.from,
    after: position === 'after',
    inside: position === 'center',
  }
}
function canDrop(
  sources: TreeNode[],
  target: TreeNode,
  position: DropPosition,
) {
  const move = getMove(sources, target, position)
  return Boolean(move && createOutlineMove(props.content, move))
}
function dragNode({
  nodes: sources,
  target,
  position,
}: {
  nodes: TreeNode[]
  target: TreeNode
  position: DropPosition
}) {
  const move = getMove(sources, target, position)
  if (move && createOutlineMove(props.content, move))
    emit('move', move)
}
function reveal({ node }: { node: TreeNode }) {
  if (!props.disabled)
    emit('reveal', (node as OutlineNode).heading)
}
function headingLevel(node: TreeNode) {
  return (node as OutlineNode).heading.level
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="scrollbar min-h-0 flex-1 overflow-y-auto p-3">
      <UiText
        v-if="!headings.length"
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("notes.inspector.outline.empty") }}
      </UiText>
      <template v-else>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <UiTree
            :model-value="nodes"
            :selected-ids="selected"
            :can-drag="() => canEdit && !disabled"
            :can-drop="canDrop"
            @click-node="reveal"
            @toggle-node="toggleNode"
            @drag-node="dragNode"
          >
            <template #icon="{ node }">
              <UiText
                variant="xs"
                muted
                class="mr-1 shrink-0"
              >
                H{{ headingLevel(node) }}
              </UiText>
            </template>
          </UiTree>
        </div>
      </template>
    </div>
  </div>
</template>
