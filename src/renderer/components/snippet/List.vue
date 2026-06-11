<script setup lang="ts">
import { useApp, useDeleteShortcut, useSnippets } from '@/composables'
import { setSnippetScrollerRef } from '@/composables/useSnippetScroller'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'

const listRef = ref<HTMLDivElement>()
const snippetScrollerLocalRef = ref<{
  scrollToItem: (index: number) => void
} | null>(null)
const SNIPPET_ITEM_SIZE = 61
const SNIPPET_ITEM_COMPACT_SIZE = 37
const isInitialSnippetPositionRestored = ref(false)

const { focusedSnippetId, highlightedSnippetIds, isCompactListMode, state }
  = useApp()
const { deleteSelectedSnippets, displayedSnippets } = useSnippets()

// Single handler instead of per-item onClickOutside: clicks outside the list
// clear focus/highlight, while the capture click inside the list clears state
// before item click handlers set focus again (same net behavior as before).
function clearSnippetInteractionState() {
  focusedSnippetId.value = undefined
  highlightedSnippetIds.value.clear()
}

onClickOutside(listRef, clearSnippetInteractionState)

const snippetItemSize = computed(() =>
  isCompactListMode.value ? SNIPPET_ITEM_COMPACT_SIZE : SNIPPET_ITEM_SIZE,
)

function setScrollerRef(
  value: { scrollToItem: (index: number) => void } | null,
) {
  snippetScrollerLocalRef.value = value
  setSnippetScrollerRef(value)
}

useDeleteShortcut({
  rootSelector: '[data-snippets-list]',
  isEnabled: () => focusedSnippetId.value !== undefined,
  onDelete: deleteSelectedSnippets,
})

watch(
  [displayedSnippets, () => state.snippetId, snippetScrollerLocalRef],
  ([snippets, snippetId, scroller]) => {
    if (isInitialSnippetPositionRestored.value)
      return

    if (!scroller || !snippets?.length || snippetId === undefined)
      return

    const index = snippets.findIndex(snippet => snippet.id === snippetId)

    if (index < 0)
      return

    isInitialSnippetPositionRestored.value = true

    nextTick(() => {
      requestAnimationFrame(() => {
        scroller.scrollToItem(index)
      })
    })
  },
  {
    immediate: true,
    flush: 'post',
  },
)
</script>

<template>
  <div
    ref="listRef"
    data-snippets-list
    class="flex h-full flex-col"
    @click.capture="clearSnippetInteractionState"
  >
    <div>
      <SnippetHeader />
    </div>
    <RecycleScroller
      v-if="displayedSnippets?.length"
      :ref="setScrollerRef"
      v-slot="{ item }"
      class="scrollbar flex-grow px-2"
      :items="displayedSnippets"
      :item-size="snippetItemSize"
      key-field="id"
    >
      <SnippetItem :snippet="item" />
    </RecycleScroller>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('placeholder.emptySnippetsList')"
    />
  </div>
</template>
