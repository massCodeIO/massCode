<script setup lang="ts">
import type { DiffChangeType, DiffNode } from '@/composables'
import { ChevronRight } from 'lucide-vue-next'

defineOptions({
  name: 'DevtoolsCompareJsonDiffNode',
})

const props = defineProps<{
  node: DiffNode
  side: 'left' | 'right'
  depth: number
  isExpanded: (node: DiffNode, depth: number) => boolean
}>()

const emit = defineEmits<{
  toggle: [path: string]
}>()

const expanded = computed(() => props.isExpanded(props.node, props.depth))
const value = computed(() => {
  return props.side === 'left' ? props.node.leftValue : props.node.rightValue
})
const isHidden = computed(() => {
  return (
    (props.node.changeType === 'added' && props.side === 'left')
    || (props.node.changeType === 'removed' && props.side === 'right')
  )
})
const isExpandable = computed(() => !!props.node.children?.length)

const highlightClassByType: Record<DiffChangeType, string> = {
  added: 'bg-diff-added-bg',
  removed: 'bg-diff-removed-bg',
  modified: 'bg-diff-modified-bg',
  unchanged: '',
}

const highlightClass = computed(() => {
  if (isHidden.value)
    return ''

  return highlightClassByType[props.node.changeType]
})

function formatValue(rawValue: unknown) {
  if (rawValue === undefined)
    return ''

  return JSON.stringify(rawValue)
}

function getCollapsedPreview(node: DiffNode) {
  if (node.type === 'array')
    return `[${node.children?.length ?? 0}]`

  if (node.type === 'object')
    return `{${node.children?.length ?? 0}}`

  return ''
}

function toggle() {
  if (isExpandable.value)
    emit('toggle', props.node.path)
}
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1 rounded-sm px-1 py-0.5"
      :class="highlightClass"
      :style="{
        paddingLeft: `${props.depth * 16 + 4}px`,
        fontFamily: 'var(--json-diff-font-family)',
        fontSize: 'var(--json-diff-font-size)',
        lineHeight: 'var(--json-diff-line-height)',
      }"
    >
      <button
        v-if="isExpandable"
        type="button"
        class="text-muted-foreground flex size-4 shrink-0 items-center justify-center"
        @click.stop="toggle"
      >
        <ChevronRight
          class="size-3 transition-transform duration-150"
          :class="{ 'rotate-90': expanded }"
        />
      </button>
      <span
        v-else
        class="inline-block size-4 shrink-0"
      />

      <span class="text-foreground shrink-0"> {{ props.node.key }}: </span>

      <span
        v-if="isHidden"
        class="text-muted-foreground/50 truncate italic"
      >
        -
      </span>
      <template v-else-if="isExpandable">
        <span
          v-if="expanded"
          class="text-muted-foreground"
        >
          {{ props.node.type === "array" ? "[" : "{" }}
        </span>
        <span
          v-else
          class="text-muted-foreground truncate"
        >
          {{ getCollapsedPreview(props.node) }}
        </span>
      </template>
      <span
        v-else
        class="truncate"
      >
        {{ formatValue(value) }}
      </span>
    </div>

    <template v-if="props.node.children?.length && expanded">
      <DevtoolsCompareJsonDiffNode
        v-for="child in props.node.children"
        :key="child.path"
        :node="child"
        :side="props.side"
        :depth="props.depth + 1"
        :is-expanded="props.isExpanded"
        @toggle="emit('toggle', $event)"
      />
      <div
        class="text-muted-foreground"
        :style="{
          paddingLeft: `${props.depth * 16 + 24}px`,
          fontFamily: 'var(--json-diff-font-family)',
          fontSize: 'var(--json-diff-font-size)',
          lineHeight: 'var(--json-diff-line-height)',
        }"
      >
        {{ props.node.type === "array" ? "]" : "}" }}
      </div>
    </template>
  </div>
</template>
