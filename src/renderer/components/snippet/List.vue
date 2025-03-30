<script setup lang="ts">
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import { useApp, useGutter, useSnippets } from '@/composables'
import { store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const listRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()
const scrollbarRef = ref<PerfectScrollbarExpose | null>(null)

const { snippetListWidth, sidebarWidth } = useApp()
const { displayedSnippets } = useSnippets()

const offsetWidth = computed(() => {
  return (
    Number.parseInt(sidebarWidth.value as string)
    + Number.parseInt(snippetListWidth.value as string)
  )
})

const { width } = useGutter(
  listRef,
  gutterRef,
  offsetWidth.value,
  APP_DEFAULTS.sizes.snippetList + APP_DEFAULTS.sizes.sidebar,
)

watch(width, () => {
  const _width = width.value - Number.parseInt(sidebarWidth.value as string)

  snippetListWidth.value = `${_width}px`
  store.app.set('snippetListWidth', _width)
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
    <PerfectScrollbar ref="scrollbarRef">
      <div class="flex-grow overflow-y-auto">
        <SnippetItem
          v-for="snippet in displayedSnippets"
          :key="snippet.id"
          :snippet="snippet"
        />
      </div>
    </PerfectScrollbar>
    <UiGutter ref="gutterRef" />
  </div>
</template>
