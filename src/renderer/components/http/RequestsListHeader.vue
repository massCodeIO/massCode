<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
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
const {
  createHttpRequestAndSelect,
  getHttpRequests,
  isRestoreStateBlocked,
  selectFirstRequest,
} = useHttpRequests()
const { clearFolderSelection, folders, getFolderByIdFromTree }
  = useHttpFolders()
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

const removeSearchContextLabel = computed(() =>
  i18n.t('search.removeContextFilter', {
    filter: searchContextLabel.value || '',
  }),
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

async function clearSearchContext() {
  if (httpState.folderId) {
    clearFolderSelection()
  }
  else if (httpState.libraryFilter) {
    httpState.libraryFilter = undefined
  }

  isRestoreStateBlocked.value = true
  await getHttpRequests()
  selectFirstRequest()
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
      <div
        v-if="searchContextLabel"
        class="bg-muted text-muted-foreground ml-2 flex max-w-32 shrink-0 items-center rounded-full px-2 py-0.5 text-xs"
      >
        <span class="truncate">{{ searchContextLabel }}</span>
        <Tooltip.Tooltip>
          <Tooltip.TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="ml-1 size-4 rounded-full p-0"
              :aria-label="removeSearchContextLabel"
              @click="clearSearchContext"
            >
              <X class="size-3" />
            </Button>
          </Tooltip.TooltipTrigger>
          <Tooltip.TooltipContent>
            {{ removeSearchContextLabel }}
          </Tooltip.TooltipContent>
        </Tooltip.Tooltip>
      </div>
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('placeholder.search')"
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
