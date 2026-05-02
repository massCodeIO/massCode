<script setup lang="ts">
import { useHttpApp, useHttpSearch } from '@/composables'
import { i18n } from '@/electron'

const { httpState } = useHttpApp()
const { displayedRequests, isSearch } = useHttpSearch()

const filteredRequests = computed(() => {
  const list = displayedRequests.value || []

  if (isSearch.value || httpState.folderId === undefined) {
    return list
  }

  return list.filter(r => r.folderId === httpState.folderId)
})
</script>

<template>
  <div class="flex h-full flex-col">
    <HttpRequestsListHeader />
    <div
      v-if="filteredRequests.length === 0"
      class="flex-1"
    >
      <UiEmptyPlaceholder :text="i18n.t('spaces.http.empty')" />
    </div>
    <div
      v-else
      class="scrollbar flex-grow overflow-y-auto px-2"
    >
      <HttpRequestsListItem
        v-for="request in filteredRequests"
        :key="request.id"
        :request="request"
      />
    </div>
  </div>
</template>
