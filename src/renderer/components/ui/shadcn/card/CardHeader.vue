<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card-header"
    :class="
      cn(
        '[&.border-b]:border-border @container/card-header grid auto-rows-min grid-cols-[minmax(0,1fr)] items-start gap-1 px-4 py-3 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto] [&.border-b]:border-b',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
