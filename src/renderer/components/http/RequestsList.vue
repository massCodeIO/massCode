<script setup lang="ts">
import { useHttpApp, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'

const { httpState } = useHttpApp()
const { requests } = useHttpRequests()

const searchQuery = ref('')

const displayedRequests = computed(() => {
  const folderFiltered
    = httpState.folderId === undefined
      ? requests.value
      : requests.value.filter(r => r.folderId === httpState.folderId)

  const term = searchQuery.value.trim().toLowerCase()
  if (!term) {
    return folderFiltered
  }
  return folderFiltered.filter(r => r.name.toLowerCase().includes(term))
})
</script>

<template>
  <div class="flex h-full flex-col">
    <HttpRequestsListHeader v-model:search-query="searchQuery" />
    <div
      v-if="displayedRequests.length === 0"
      class="flex-1"
    >
      <UiEmptyPlaceholder :text="i18n.t('spaces.http.empty')" />
    </div>
    <div
      v-else
      class="scrollbar flex-grow overflow-y-auto px-2"
    >
      <HttpRequestsListItem
        v-for="request in displayedRequests"
        :key="request.id"
        :request="request"
      />
    </div>
  </div>
</template>
