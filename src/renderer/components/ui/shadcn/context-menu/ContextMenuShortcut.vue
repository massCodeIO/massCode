<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span
    :class="
      cn('text-text-muted ml-auto text-[10px] tracking-widest', props.class)
    "
  >
    <slot />
  </span>
</template>
