<script setup lang="ts">
import type {
  SplitterResizeHandleEmits,
  SplitterResizeHandleProps,
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { reactiveOmit } from '@vueuse/core'
import { GripVertical } from 'lucide-vue-next'
import { SplitterResizeHandle, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<
  SplitterResizeHandleProps & {
    class?: HTMLAttributes['class']
    withHandle?: boolean
  }
>()
const emits = defineEmits<SplitterResizeHandleEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'withHandle')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SplitterResizeHandle
    data-slot="resizable-handle"
    v-bind="forwarded"
    :class="
      cn(
        'group/resizable-handle focus-visible:ring-ring before:bg-border hover:before:bg-primary focus-visible:before:bg-primary relative flex w-px items-center justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:transition-[background-color,width,height] before:delay-0 before:duration-150 before:content-[\'\'] after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 after:content-[\'\'] hover:before:w-0.5 hover:before:delay-200 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden focus-visible:before:w-0.5 focus-visible:before:delay-0 data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:before:top-1/2 data-[orientation=vertical]:before:left-0 data-[orientation=vertical]:before:h-px data-[orientation=vertical]:before:w-full data-[orientation=vertical]:before:translate-x-0 data-[orientation=vertical]:before:-translate-y-1/2 data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:translate-x-0 data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:hover:before:h-0.5 data-[orientation=vertical]:focus-visible:before:h-0.5 [&[data-orientation=vertical]>div]:rotate-90',
        props.class,
      )
    "
  >
    <template v-if="props.withHandle">
      <div
        class="bg-background border-border text-muted-foreground group-hover/resizable-handle:border-primary group-hover/resizable-handle:bg-primary/10 group-hover/resizable-handle:text-primary group-focus-visible/resizable-handle:border-primary group-focus-visible/resizable-handle:bg-primary/10 group-focus-visible/resizable-handle:text-primary z-10 flex h-4 w-3 items-center justify-center rounded-xs border transition-[border-color,background-color,color] delay-0 duration-150 group-hover/resizable-handle:delay-200 group-focus-visible/resizable-handle:delay-0"
      >
        <slot>
          <GripVertical class="size-2.5" />
        </slot>
      </div>
    </template>
  </SplitterResizeHandle>
</template>
