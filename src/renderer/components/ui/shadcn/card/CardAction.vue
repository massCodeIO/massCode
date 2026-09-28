<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card-action"
    :class="
      cn(
        'col-start-2 row-span-2 row-start-1 flex shrink-0 items-center gap-2 self-start justify-self-end',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
