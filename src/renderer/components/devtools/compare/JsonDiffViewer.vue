<script setup lang="ts">
import type { DiffNode } from '@/composables'

const props = defineProps<{
  nodes: DiffNode[]
  isExpanded: (node: DiffNode, depth: number) => boolean
}>()

const emit = defineEmits<{
  toggle: [path: string]
}>()

const leftPanel = useTemplateRef('leftPanel')
const rightPanel = useTemplateRef('rightPanel')
const isSyncing = ref(false)

function syncScroll(source: 'left' | 'right') {
  if (isSyncing.value)
    return

  const from = source === 'left' ? leftPanel.value : rightPanel.value
  const to = source === 'left' ? rightPanel.value : leftPanel.value

  if (!from || !to)
    return

  isSyncing.value = true
  to.scrollTop = from.scrollTop
  to.scrollLeft = from.scrollLeft

  requestAnimationFrame(() => {
    isSyncing.value = false
  })
}
</script>

<template>
  <div class="grid h-full min-h-0 gap-3 md:grid-cols-2">
    <div
      ref="leftPanel"
      class="scrollbar bg-card min-h-0 overflow-auto rounded-md border p-2"
      @scroll="syncScroll('left')"
    >
      <DevtoolsCompareJsonDiffNode
        v-for="node in props.nodes"
        :key="node.path"
        :node="node"
        side="left"
        :depth="0"
        :is-expanded="props.isExpanded"
        @toggle="emit('toggle', $event)"
      />
    </div>
    <div
      ref="rightPanel"
      class="scrollbar bg-card min-h-0 overflow-auto rounded-md border p-2"
      @scroll="syncScroll('right')"
    >
      <DevtoolsCompareJsonDiffNode
        v-for="node in props.nodes"
        :key="node.path"
        :node="node"
        side="right"
        :depth="0"
        :is-expanded="props.isExpanded"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </div>
</template>
