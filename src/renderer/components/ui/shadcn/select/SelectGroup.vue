<script setup lang="ts">
import type { SelectGroupProps } from 'radix-vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { SelectGroup } from 'radix-vue'
import { computed } from 'vue'

const props = defineProps<
  SelectGroupProps & { class?: HTMLAttributes['class'] }
>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})
</script>

<template>
  <SelectGroup
    :class="cn('w-full p-1', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </SelectGroup>
</template>
