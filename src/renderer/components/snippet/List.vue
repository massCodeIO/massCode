<script setup lang="ts">
import type { SnippetsQuery } from '@/services/api/generated'
import { ScrollArea } from '@/components/ui/shadcn/scroll-area'
import { useApp, useGutter, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const listRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const { snippetListWidth, sidebarWidth, selectedFolderId, selectedLibrary }
  = useApp()
const { displayedSnippets, getSnippets } = useSnippets()

async function initGetSnippets() {
  const query: SnippetsQuery = {}

  if (selectedFolderId.value) {
    query.folderId = selectedFolderId.value
  }
  else if (selectedLibrary.value === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (selectedLibrary.value === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (selectedLibrary.value === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (selectedLibrary.value === LibraryFilter.Inbox) {
    query.isInbox = 1
  }

  await getSnippets(query)
}

initGetSnippets()

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
    class="relative flex h-screen flex-col px-1"
  >
    <div>
      <SnippetHeader />
    </div>
    <ScrollArea>
      <div class="flex-grow overflow-y-auto">
        <SnippetItem
          v-for="snippet in displayedSnippets"
          :key="snippet.id"
          :snippet="snippet"
        />
      </div>
    </ScrollArea>
    <UiGutter ref="gutterRef" />
  </div>
</template>
