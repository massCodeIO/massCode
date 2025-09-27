<script setup lang="ts">
import { useApp } from '@/composables'
import { onClickOutside } from '@vueuse/core'
import { Tag } from 'lucide-vue-next'

interface Props {
  id: number
  name: string
}

const props = defineProps<Props>()

const { highlightedTagId, state } = useApp()

const tagRef = useTemplateRef('tagRef')

const isFocused = ref(false)
const isSelected = computed(() => state.tagId === props.id)
const isHighlighted = computed(() => highlightedTagId.value === props.id)

function onClickItem() {
  highlightedTagId.value = undefined
  isFocused.value = true
}

onClickOutside(tagRef, () => {
  isFocused.value = false
})
</script>

<template>
  <div
    ref="tagRef"
    :data-selected="isSelected ? 'true' : undefined"
    :data-focused="isFocused ? 'true' : undefined"
    :data-highlighted="isHighlighted ? 'true' : undefined"
    class="data-[selected=true]:bg-list-selection data-[focused=true]:bg-list-focus! data-[focused=true]:text-list-focus-fg data-[highlighted=true]:outline-primary flex items-center gap-2 rounded-md px-6 select-none data-[highlighted=true]:bg-transparent! data-[highlighted=true]:outline-2 data-[highlighted=true]:-outline-offset-2"
    @click="onClickItem"
  >
    <Tag class="h-3 w-3 shrink-0" />
    <span class="truncate">{{ name }}</span>
  </div>
</template>
