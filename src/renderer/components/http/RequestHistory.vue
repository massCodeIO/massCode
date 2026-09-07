<script setup lang="ts">
import { useHttpExecute } from '@/composables'
import { useHttpHistory } from '@/composables/spaces/http/useHttpHistory'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { i18n } from '@/electron'

const { history, getHttpHistory, loading, loadError } = useHttpHistory()
const { currentRequest } = useHttpRequests()
const { isExecuting } = useHttpExecute()
const entries = computed(() =>
  history.value.filter(entry => entry.requestId === currentRequest.value?.id),
)
watch(
  [() => currentRequest.value?.id, isExecuting],
  () => {
    if (!isExecuting.value)
      void getHttpHistory()
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-1">
    <UiText
      v-if="loading || loadError || !entries.length"
      variant="xs"
      muted
    >
      {{
        i18n.t(
          loading
            ? "spaces.http.collection.dashboard.loading"
            : loadError
              ? "spaces.http.collection.dashboard.loadFailed"
              : "spaces.http.history.empty",
        )
      }}
    </UiText>
    <HttpHistoryEntry
      v-for="entry in entries"
      :key="entry.id"
      :entry="entry"
    />
  </div>
</template>
