<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card-footer"
    :class="
      cn(
        '[&.border-t]:border-border flex items-center px-4 py-3 [&.border-t]:border-t',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
