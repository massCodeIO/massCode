<script setup lang="ts">
import type { NodeData } from '../types'

import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  data: NodeData
  id: string
}>()

function getDisplayProperties() {
  const obj = props.data.value || {}
  return obj
}

function formatValue(value: any) {
  if (value === null)
    return 'null'
  if (value === undefined)
    return 'undefined'
  if (typeof value === 'object') {
    if (Array.isArray(value))
      return `[${value.length} items]`
    return `{${Object.keys(value).length} keys}`
  }
  if (typeof value === 'string')
    return `"${value}"`
  return String(value)
}
</script>

<template>
  <div
    class="max-w-[350px] min-w-[200px] cursor-pointer rounded-lg border-2 border-blue-500 bg-white p-3 shadow-md transition-all duration-200 hover:border-blue-600 hover:shadow-lg dark:bg-[var(--color-bg)]"
  >
    <Handle
      type="target"
      :position="Position.Left"
    />

    <div class="flex flex-col gap-2">
      <div
        class="flex items-center justify-between border-b border-[var(--color-border)] pb-2"
      >
        <span class="text-sm font-semibold text-[var(--color-text)]">{{
          data.label
        }}</span>
        <span
          class="rounded bg-[var(--color-button)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]"
        >Object</span>
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="(value, key) in getDisplayProperties()"
          :key="key"
          class="flex gap-1.5 text-xs leading-relaxed"
        >
          <span class="font-medium text-blue-500">{{ key }}:</span>
          <span class="font-mono break-words text-[var(--color-text-muted)]">{{
            formatValue(value)
          }}</span>
        </div>
      </div>
    </div>

    <Handle
      type="source"
      :position="Position.Right"
    />
  </div>
</template>
