<script setup lang="ts">
import { useApp, useGutter, useSnippets } from '@/composables'
import { snippetScrollerRef } from '@/composables/useSnippetScroller'
import { i18n, store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const listRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const { snippetListWidth } = useApp()
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
      ref="snippetScrollerRef"
      v-slot="{ item }"
      class="scrollbar flex-grow px-2"
      :items="displayedSnippets"
      :item-size="58"
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
