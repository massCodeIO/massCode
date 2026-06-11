<script setup lang="ts">
import {
  useDeleteShortcut,
  useHttpApp,
  useHttpRequests,
  useHttpSearch,
} from '@/composables'
import { i18n } from '@/electron'

const { focusedRequestId } = useHttpApp()
const { deleteSelectedHttpRequests } = useHttpRequests()
const { displayedRequests } = useHttpSearch()

const filteredRequests = computed(() => displayedRequests.value || [])

useDeleteShortcut({
  rootSelector: '[data-http-requests-list]',
  isEnabled: () => focusedRequestId.value !== undefined,
  onDelete: deleteSelectedHttpRequests,
})
</script>

<template>
  <div
    data-http-requests-list
    class="flex h-full flex-col"
  >
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
