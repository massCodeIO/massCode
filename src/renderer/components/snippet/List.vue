<script setup lang="ts">
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import { useApp, useGutter, useSnippets } from '@/composables'
import { i18n, store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const listRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()
const scrollbarRef = ref<PerfectScrollbarExpose | null>(null)

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

watch(displayedSnippets, () => {
  nextTick(() => {
    if (scrollbarRef.value) {
      scrollbarRef.value.ps?.update()
    }
  })
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
    <PerfectScrollbar
      v-if="displayedSnippets?.length"
      ref="scrollbarRef"
      :options="{ minScrollbarLength: 20, suppressScrollX: true }"
    >
      <div class="flex-grow overflow-y-auto px-2">
        <SnippetItem
          v-for="snippet in displayedSnippets"
          :key="snippet.id"
          :snippet="snippet"
        />
      </div>
    </PerfectScrollbar>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('placeholder.emptySnippetsList')"
    />
    <UiGutter ref="gutterRef" />
  </div>
</template>
