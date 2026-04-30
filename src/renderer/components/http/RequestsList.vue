<script setup lang="ts">
import { useHttpApp, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'

const { httpState } = useHttpApp()
const { requests } = useHttpRequests()

const displayedRequests = computed(() => {
  if (httpState.folderId === undefined) {
    return requests.value
  }
  return requests.value.filter(r => r.folderId === httpState.folderId)
})
</script>

<template>
  <div class="flex h-full flex-col">
    <RequestsListHeader />
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
      <RequestsListItem
        v-for="request in displayedRequests"
        :key="request.id"
        :request="request"
      />
    </div>
  </div>
</template>
