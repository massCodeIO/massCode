<script setup lang="ts">
import { useApp, useGutter, useSnippets } from '@/composables'
import { store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const listRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const { snippetListWidth, sidebarWidth, selectedFolderId } = useApp()
const { snippets, snippetsBySearch, isSearch, getSnippets } = useSnippets()

getSnippets({ folderId: selectedFolderId.value })

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
</script>

<template>
  <div
    ref="listRef"
    data-snippets-list
    class="relative flex flex-col h-screen"
  >
    <div>
      <SnippetHeader />
    </div>
    <div class="flex-grow overflow-y-auto">
      <SnippetItem
        v-for="snippet in isSearch ? snippetsBySearch : snippets"
        :key="snippet.id"
        :snippet="snippet"
      />
    </div>
    <UiGutter ref="gutterRef" />
  </div>
</template>
