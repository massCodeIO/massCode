<script setup lang="ts">
import type { ScrollAreaScrollbarProps } from 'radix-vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { ScrollAreaScrollbar, ScrollAreaThumb } from 'radix-vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<ScrollAreaScrollbarProps & { class?: HTMLAttributes['class'] }>(),
  {
    orientation: 'vertical',
  },
)

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})
</script>

<template>
  <ScrollAreaScrollbar
    v-bind="delegatedProps"
    :class="
      cn(
        'z-50 flex touch-none transition-colors select-none',
        orientation === 'vertical'
          && 'border-border h-full w-2.5 border-l border-l-transparent p-px',
        orientation === 'horizontal'
          && 'border-border h-2.5 flex-col border-t border-t-transparent p-px',
        props.class,
      )
    "
  >
    <ScrollAreaThumb
      class="bg-scrollbar active:bg-primary relative flex-1 rounded-full"
    />
  </ScrollAreaScrollbar>
</template>
