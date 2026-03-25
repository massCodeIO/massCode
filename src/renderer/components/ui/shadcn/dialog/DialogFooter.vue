<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Button } from '@/components/ui/shadcn/button'
import { cn } from '@/utils'
import { DialogClose } from 'reka-ui'

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class']
    showCloseButton?: boolean
  }>(),
  {
    showCloseButton: false,
  },
)
</script>

<template>
  <div
    data-slot="dialog-footer"
    :class="
      cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', props.class)
    "
  >
    <slot />
    <DialogClose
      v-if="showCloseButton"
      as-child
    >
      <Button variant="outline">
        Close
      </Button>
    </DialogClose>
  </div>
</template>
