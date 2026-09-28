<script setup lang="ts">
import type { DialogRootEmits, DialogRootProps } from 'reka-ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog'
import { reactiveOmit } from '@vueuse/core'
import { useForwardPropsEmits } from 'reka-ui'
import Command from './Command.vue'

const props = withDefaults(
  defineProps<
    DialogRootProps & {
      title?: string
      description?: string
      showCloseButton?: boolean
    }
  >(),
  {
    title: 'Command Palette',
    description: 'Search for a command to run...',
    showCloseButton: false,
  },
)
const emits = defineEmits<DialogRootEmits>()

const delegatedProps = reactiveOmit(
  props,
  'description',
  'showCloseButton',
  'title',
)

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <Dialog
    v-slot="slotProps"
    v-bind="forwarded"
  >
    <DialogContent
      class="overflow-hidden p-0"
      :show-close-button="showCloseButton"
      @close-auto-focus.prevent
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <Command>
        <slot v-bind="slotProps" />
      </Command>
    </DialogContent>
  </Dialog>
</template>
