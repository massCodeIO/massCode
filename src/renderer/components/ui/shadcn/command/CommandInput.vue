<script setup lang="ts">
import type { ListboxFilterProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'
import { reactiveOmit } from '@vueuse/core'
import { LoaderCircle, Search, X } from 'lucide-vue-next'
import { ListboxFilter, useForwardProps } from 'reka-ui'
import { useCommand } from '.'

interface CommandInputFilterToken {
  clearLabel: string
  id: string
  label: string
}

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<
  ListboxFilterProps & {
    class?: HTMLAttributes['class']
    isLoading?: boolean
    filterTokens?: CommandInputFilterToken[]
    scopeClearLabel?: string
    scopeLabel?: string
  }
>()
const emit = defineEmits<{
  'clearScope': []
  'clearFilterToken': [id: string]
  'update:modelValue': [value: string]
  'searchChange': [value: string]
}>()

const delegatedProps = reactiveOmit(
  props,
  'class',
  'isLoading',
  'filterTokens',
  'modelValue',
  'scopeClearLabel',
  'scopeLabel',
)

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
    <button
      v-if="scopeLabel"
      type="button"
      class="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-6 max-w-36 shrink-0 items-center gap-1 rounded-sm px-2 text-xs"
      :aria-label="scopeClearLabel"
      @click="emit('clearScope')"
    >
      <span class="truncate">{{ scopeLabel }}</span>
      <X class="size-3 shrink-0" />
    </button>
    <button
      v-for="token in filterTokens"
      :key="token.id"
      type="button"
      class="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-6 max-w-36 shrink-0 items-center gap-1 rounded-sm px-2 text-xs"
      :aria-label="token.clearLabel"
      @click="emit('clearFilterToken', token.id)"
    >
      <span class="truncate">{{ token.label }}</span>
      <X class="size-3 shrink-0" />
    </button>
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
