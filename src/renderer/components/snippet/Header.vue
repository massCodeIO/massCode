<script setup lang="ts">
import { useApp, useFolders, useSnippets, useTags } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n, ipc } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const {
  isSearch,
  searchQuery,
  createSnippetAndSelect,
  clearSearch,
  search,
  searchSelectedIndex,
  selectSearchSnippet,
  displayedSnippets,
} = useSnippets()
const { isFocusedSearch, state } = useApp()
const { folders, getFolderByIdFromTree } = useFolders()
const { tags } = useTags()

const libraryFilterLabels = computed<Record<string, string>>(() => ({
  [LibraryFilter.Inbox]: i18n.t('common.inbox'),
  [LibraryFilter.Favorites]: i18n.t('common.favorites'),
  [LibraryFilter.All]: i18n.t('spaces.code.allSnippets'),
  [LibraryFilter.Trash]: i18n.t('common.trash'),
}))

const searchContextLabel = computed(() => {
  if (state.tagId) {
    const tag = tags.value.find(item => item.id === state.tagId)
    return tag ? `#${tag.name}` : undefined
  }

  if (state.folderId) {
    return getFolderByIdFromTree(folders.value, state.folderId)?.name
  }

  return state.libraryFilter
    ? libraryFilterLabels.value[state.libraryFilter]
    : undefined
})

const searchPlaceholder = computed(() =>
  searchContextLabel.value
    ? i18n.t('placeholder.searchIn', { context: searchContextLabel.value })
    : i18n.t('placeholder.search'),
)

ipc.on('main-menu:find', () => {
  isFocusedSearch.value = true
})

watch(searchQuery, (v) => {
  if (v) {
    search()
  }
  else {
    clearSearch(true)
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const nextIndex = Math.min(
      searchSelectedIndex.value + 1,
      (displayedSnippets.value?.length || 0) - 1,
    )
    selectSearchSnippet(nextIndex)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const prevIndex = Math.max(searchSelectedIndex.value - 1, 0)
    selectSearchSnippet(prevIndex)
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    clearSearch(true)
  }
}
</script>

<template>
  <div class="border-border mt-[var(--content-top-offset)] mb-2 border-b pb-1">
    <div class="flex items-center px-1">
      <Search class="text-muted-foreground ml-1 h-4 w-4 shrink-0" />
      <div class="min-w-0 flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          variant="ghost"
          class="truncate"
          :focus="isFocusedSearch"
          @blur="isFocusedSearch = false"
          @keydown="onKeydown"
        />
      </div>
      <UiActionButton
        v-if="searchQuery"
        :tooltip="i18n.t('action.clearSearch')"
        @click="clearSearch(true)"
      >
        <X class="h-4 w-4" />
      </UiActionButton>
      <UiActionButton
        v-else-if="!isSearch"
        :tooltip="i18n.t('action.new.snippet')"
        @click="createSnippetAndSelect"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
