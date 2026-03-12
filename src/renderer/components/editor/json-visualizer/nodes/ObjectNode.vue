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
    class="dark:bg-background max-w-[350px] min-w-[200px] cursor-pointer rounded-lg border-2 border-blue-500 bg-white p-3 shadow-md transition-all duration-200 hover:border-blue-600 hover:shadow-lg"
  >
    <Handle
      type="target"
      :position="Position.Left"
    />

    <div class="flex flex-col gap-2">
      <div
        class="border-border flex items-center justify-between border-b pb-2"
      >
        <span class="text-foreground text-sm font-semibold">{{
          data.label
        }}</span>
        <span
          class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
        >Object</span>
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="(value, key) in getDisplayProperties()"
          :key="key"
          class="flex gap-1.5 text-xs leading-relaxed"
        >
          <span class="font-medium text-blue-500">{{ key }}:</span>
          <UiText
            mono
            class="text-muted-foreground break-words"
          >
            {{ formatValue(value) }}
          </UiText>
        </div>
      </div>
    </div>

    <Handle
      type="source"
      :position="Position.Right"
    />
  </div>
</template>
