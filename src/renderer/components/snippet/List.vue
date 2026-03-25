<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
import { setSnippetScrollerRef } from '@/composables/useSnippetScroller'
import { i18n } from '@/electron'

const snippetScrollerLocalRef = ref<{
  scrollToItem: (index: number) => void
} | null>(null)
const isInitialSnippetPositionRestored = ref(false)
const SNIPPET_ITEM_SIZE = 61

const { state } = useApp()
const { displayedSnippets } = useSnippets()

function setScrollerRef(
  value: { scrollToItem: (index: number) => void } | null,
) {
  snippetScrollerLocalRef.value = value
  setSnippetScrollerRef(value)
}

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
    data-snippets-list
    class="flex h-full flex-col"
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
      :item-size="SNIPPET_ITEM_SIZE"
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
