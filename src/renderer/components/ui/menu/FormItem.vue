<script setup lang="ts">
import { cn } from '@/utils'

interface Props {
  label: string
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="cn('grid max-w-3xl grid-cols-[200px_1fr] gap-2', props.class)">
    <div>
      {{ label }}
    </div>
    <div class="space-y-2">
      <slot />
      <div
        v-if="$slots.description"
        class="text-text-muted text-sm"
      >
        <slot name="description" />
      </div>
      <div v-if="$slots.actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
