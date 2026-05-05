<script setup lang="ts">
import type { ListboxFilterProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { reactiveOmit } from '@vueuse/core'
import { LoaderCircle, Search } from 'lucide-vue-next'
import { ListboxFilter, useForwardProps } from 'reka-ui'
import { useCommand } from '.'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<
  ListboxFilterProps & {
    class?: HTMLAttributes['class']
    isLoading?: boolean
  }
>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'searchChange': [value: string]
}>()

const delegatedProps = reactiveOmit(props, 'class', 'isLoading', 'modelValue')

const forwardedProps = useForwardProps(delegatedProps)

const { filterState } = useCommand()

watch(
  () => props.modelValue,
  (value) => {
    const search = value ?? ''

    if (filterState.search !== search) {
      filterState.search = search
    }
  },
  { immediate: true },
)

function updateSearch(value: string) {
  filterState.search = value
  emit('update:modelValue', value)
  emit('searchChange', value)
}
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="flex h-9 items-center gap-2 border-b px-3"
  >
    <Search class="size-4 shrink-0 opacity-50" />
    <ListboxFilter
      v-bind="{ ...forwardedProps, ...$attrs }"
      :model-value="filterState.search"
      data-slot="command-input"
      auto-focus
      :class="
        cn(
          'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
      @update:model-value="updateSearch"
    />
    <LoaderCircle
      v-if="isLoading"
      class="text-muted-foreground size-4 shrink-0 animate-spin"
    />
  </div>
</template>
