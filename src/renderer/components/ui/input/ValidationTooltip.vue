<script setup lang="ts">
import * as Popover from '@/components/ui/shadcn/popover'
import { CircleAlert } from 'lucide-vue-next'

interface Props {
  message?: string
  open?: boolean
}

defineProps<Props>()
</script>

<template>
  <Popover.Popover
    :open="open && Boolean(message)"
    :modal="false"
  >
    <Popover.PopoverAnchor as-child>
      <slot />
    </Popover.PopoverAnchor>
    <Popover.PopoverContent
      v-if="message"
      side="bottom"
      align="start"
      :side-offset="8"
      class="border-destructive/30 bg-popover text-popover-foreground ring-destructive/10 w-fit max-w-80 px-3 py-2 shadow-md ring-1"
    >
      <div class="flex items-start gap-2">
        <CircleAlert class="text-destructive mt-0.5 size-4 shrink-0" />
        <p class="text-sm leading-5">
          {{ message }}
        </p>
      </div>
    </Popover.PopoverContent>
  </Popover.Popover>
</template>
