<script setup lang="ts">
import type { SnippetsResponse } from '@/services/api/generated'
import { useApp } from '@/composables'
import { store } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'

interface Props {
  snippet: SnippetsResponse[0]
}

const props = defineProps<Props>()

const { selectedSnippetId, highlightedSnippetId } = useApp()

const isFocused = ref(false)
const snippetRef = ref<HTMLDivElement>()

const isSelected = computed(() => selectedSnippetId.value === props.snippet.id)
const isHighlighted = computed(
  () => highlightedSnippetId.value === props.snippet.id,
)

function onSnippetClick(id: number) {
  selectedSnippetId.value = id
  store.app.set('selectedSnippetId', id)
  isFocused.value = true
}

function onClickContextMenu() {
  highlightedSnippetId.value = props.snippet.id
}

onClickOutside(snippetRef, () => {
  isFocused.value = false
  highlightedSnippetId.value = undefined
})
</script>

<template>
  <div
    ref="snippetRef"
    data-snippet-item
    class="border-border relative not-first:border-t [&+.is-selected+div]:border-transparent"
    :class="{
      'is-selected': isSelected,
      'is-focused': isFocused,
      'is-highlighted': isHighlighted,
    }"
    @click="onSnippetClick(snippet.id)"
    @contextmenu="onClickContextMenu"
  >
    <div class="flex flex-col p-2 select-none">
      <div class="mb-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {{ snippet.name }}
      </div>
      <div class="meta text-text-muted flex justify-between text-xs">
        <div>
          {{ snippet.folder?.name }}
        </div>
        <div>
          {{ format(new Date(snippet.createdAt), "dd.MM.yyyy") }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@reference "../../styles.css";
[data-snippet-item] {
  &.is-selected {
    @apply bg-list-selection text-list-selection-fg rounded-md;
    .meta {
      @apply text-list-selection-fg;
    }
  }
  &.is-focused {
    @apply bg-list-focus text-list-focus-fg rounded-md;
    .meta {
      @apply text-list-focus-fg;
    }
  }
  &.is-highlighted {
    @apply outline-list-focus rounded-md outline-2 -outline-offset-2;
    &.is-focused,
    &.is-selected {
      @apply bg-bg text-list-selection-fg;
      .meta {
        @apply text-list-selection-fg;
      }
    }
  }
}
</style>
