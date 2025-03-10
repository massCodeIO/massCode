<script setup lang="ts">
import type { ComboboxItemEmits, ComboboxItemProps } from 'radix-vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { ComboboxItem, useForwardPropsEmits } from 'radix-vue'
import { computed } from 'vue'

const props = defineProps<
  ComboboxItemProps & { class?: HTMLAttributes['class'] }
>()
const emits = defineEmits<ComboboxItemEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ComboboxItem
    v-bind="forwarded"
    :class="
      cn(
        'data-[highlighted]:bg-list-selection data-[highlighted]:text-list-selection-fg relative flex cursor-default items-center rounded-sm px-2 py-0.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </ComboboxItem>
</template>
