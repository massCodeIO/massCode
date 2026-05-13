<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import {
  useHttpApp,
  useHttpFolders,
  useHttpRequests,
  useHttpSearch,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const { httpState, isFocusedSearch } = useHttpApp()
const { createHttpRequestAndSelect } = useHttpRequests()
const { folders, getFolderByIdFromTree } = useHttpFolders()
const {
  searchQuery,
  clearSearch,
  search,
  searchSelectedIndex,
  selectSearchRequest,
  displayedRequests,
  isSearch,
} = useHttpSearch()

const libraryFilterLabels = computed<Record<string, string>>(() => ({
  [LibraryFilter.Inbox]: i18n.t('common.inbox'),
  [LibraryFilter.Favorites]: i18n.t('common.favorites'),
  [LibraryFilter.All]: i18n.t('spaces.http.allRequests'),
  [LibraryFilter.Trash]: i18n.t('common.trash'),
}))

const searchContextLabel = computed(() => {
  if (httpState.folderId) {
    return getFolderByIdFromTree(folders.value, httpState.folderId)?.name
  }

  return httpState.libraryFilter
    ? libraryFilterLabels.value[httpState.libraryFilter]
    : undefined
})

const searchPlaceholder = computed(() =>
  searchContextLabel.value
    ? i18n.t('placeholder.searchIn', { context: searchContextLabel.value })
    : i18n.t('placeholder.search'),
)

watch(searchQuery, (v) => {
  if (v) {
    search()
  }
  else {
    clearSearch(true)
  }
})

async function onCreateRequest() {
  await createHttpRequestAndSelect({
    folderId: httpState.folderId ?? null,
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const nextIndex = Math.min(
      searchSelectedIndex.value + 1,
      (displayedRequests.value?.length || 0) - 1,
    )
    selectSearchRequest(nextIndex)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const prevIndex = Math.max(searchSelectedIndex.value - 1, 0)
    selectSearchRequest(prevIndex)
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
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          variant="ghost"
          :focus="isFocusedSearch"
          @blur="isFocusedSearch = false"
          @keydown="onKeydown"
        />
      </div>
      <Button
        v-if="searchQuery"
        variant="ghost"
        @click="clearSearch(true)"
      >
        <X class="h-4 w-4" />
      </Button>
      <UiActionButton
        v-if="!isSearch"
        :tooltip="i18n.t('spaces.http.action.newRequest')"
        @click="onCreateRequest"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
