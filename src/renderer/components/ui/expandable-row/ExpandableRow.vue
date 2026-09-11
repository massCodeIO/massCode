<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Button } from '@/components/ui/shadcn/button'
import { cn } from '@/utils'
import { ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  headerClass?: HTMLAttributes['class']
}>()
const expanded = defineModel<boolean>('expanded', { default: false })
</script>

<template>
  <div>
    <Button
      variant="ghost"
      :class="
        cn(
          'h-8 w-full justify-start gap-2 rounded-none border-b px-3',
          props.headerClass,
          expanded && 'bg-accent',
        )
      "
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <ChevronRight
        class="size-3 shrink-0"
        :class="{ 'rotate-90': expanded }"
      />
      <slot name="header" />
    </Button>
    <div
      v-if="expanded"
      class="border-b"
    >
      <slot />
    </div>
  </div>
</template>
