<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  contentClass?: HTMLAttributes['class']
}>()
</script>

<template>
  <details class="group/disclosure min-w-0 rounded-lg border">
    <summary
      class="hover:bg-muted/40 focus-visible:outline-ring flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-3 transition-colors focus-visible:outline-2 [&::-webkit-details-marker]:hidden"
    >
      <ChevronRight
        class="text-muted-foreground size-3.5 shrink-0 transition-transform group-open/disclosure:rotate-90 motion-reduce:transition-none"
        aria-hidden="true"
      />
      <UiText
        variant="xs"
        weight="medium"
        class="min-w-0 break-words"
      >
        <slot name="title" />
      </UiText>
    </summary>
    <div :class="cn('space-y-3 border-t px-3 py-3', props.contentClass)">
      <slot />
    </div>
  </details>
</template>
