<script setup lang="ts">
import type { Ref } from 'vue'
import type { Node } from './types'
import FolderTreeNode from './FolderTreeNode.vue'
import { folderTreeKeys } from './keys'

interface Props {
  modelValue: Node[]
  selectedId?: string | number
  contextMenuHandler?: () => Promise<boolean>
  focusHandler?: (isFocused: Ref) => void
}

interface Emits {
  (e: 'update:modelValue', value: Node[]): void
  (e: 'clickNode', value: string | number): void
  (e: 'dragNode', value: { node: Node, target: Node, position: string }): void
  (e: 'toggleNode', value: Node): void
}

const props = withDefaults(defineProps<Props>(), {
  contextMenuHandler: () => Promise.resolve(true),
})

const emit = defineEmits<Emits>()

const hoveredNodeId = ref('')
const isHoveredByIdDisabled = ref(false)

function clickNode(id: string | number) {
  return emit('clickNode', id)
}
function dragNode(node: Node, target: Node, position: string) {
  return emit('dragNode', { node, target, position })
}
function toggleNode(node: Node) {
  return emit('toggleNode', node)
}

provide(folderTreeKeys, {
  clickNode,
  dragNode,
  toggleNode,
  isHoveredByIdDisabled,
  focusHandler: props.focusHandler,
})
</script>

<template>
  <div
    data-folder-tree
    class="pt-1"
  >
    <FolderTreeNode
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
          {{ node.name }}
        </template>
      </template>
    </FolderTreeNode>
  </div>
</template>
