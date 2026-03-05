<script setup lang="ts">
import { useApp, useGutter, useSnippets } from '@/composables'
import { setSnippetScrollerRef } from '@/composables/useSnippetScroller'
import { i18n, store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const listRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()
const snippetScrollerLocalRef = ref<{
  scrollToItem: (index: number) => void
} | null>(null)
const isInitialSnippetPositionRestored = ref(false)
const SNIPPET_ITEM_SIZE = 61

const { snippetListWidth, state } = useApp()
const { displayedSnippets } = useSnippets()

const { width } = useGutter({
  target: listRef,
  gutter: gutterRef,
  orientation: 'vertical',
  options: {
    minWidth: APP_DEFAULTS.sizes.snippetList,
  },
})

watch(width, () => {
  snippetListWidth.value = `${width.value}px`
  store.app.set('sizes.snippetListWidth', width.value)
})

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
    ref="listRef"
    data-snippets-list
    class="relative flex h-screen flex-col"
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
    <UiGutter ref="gutterRef" />
  </div>
</template>
