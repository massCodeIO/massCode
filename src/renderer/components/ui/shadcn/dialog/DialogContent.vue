<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'radix-vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'radix-vue'
import { computed } from 'vue'

const props = defineProps<
  DialogContentProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 z-50 bg-black/80" />
    <DialogContent
      v-bind="forwarded"
      :class="
        cn(
          'border-border bg-bg fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-md border p-4 shadow-lg',
          props.class,
        )
      "
    >
      <slot />
      <DialogClose
        as-child
        class="absolute top-1 right-1"
      >
        <UiButton variant="icon">
          <X class="h-4 w-4" />
        </UiButton>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
