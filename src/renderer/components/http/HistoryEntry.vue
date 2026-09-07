<script setup lang="ts">
import type { HttpHistoryItem } from '@/composables/spaces/http/useHttpHistory'
import type { HttpHistorySnapshot } from '~/shared/httpHistory'
import { Button } from '@/components/ui/shadcn/button'
import { i18n, ipc } from '@/electron'
import { ChevronRight } from 'lucide-vue-next'

const props = defineProps<{ entry: HttpHistoryItem }>()
const expanded = ref(false)
const snapshot = shallowRef<HttpHistorySnapshot | null>(null)
const loading = ref(false)
const failed = ref(false)
watch(expanded, async (value, _old, onCleanup) => {
  if (!value)
    return
  let stale = false
  onCleanup(() => {
    stale = true
  })
  loading.value = true
  failed.value = false
  try {
    const result = await ipc.invoke<number, HttpHistorySnapshot | null>(
      'spaces:http:history-snapshot',
      props.entry.id,
    )
    if (!stale)
      snapshot.value = result
  }
  catch {
    if (!stale)
      failed.value = true
  }
  finally {
    if (!stale)
      loading.value = false
  }
})
</script>

<template>
  <div class="border-b">
    <Button
      variant="ghost"
      class="h-auto w-full justify-start gap-3 py-2"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <ChevronRight
        class="size-3 shrink-0"
        :class="{ 'rotate-90': expanded }"
      />
      <UiText
        variant="xs"
        :class="{
          'text-success': entry.status !== null && entry.status < 400,
          'text-destructive': entry.status === null || entry.status >= 400,
        }"
      >
        {{ entry.status ?? i18n.t("spaces.http.collection.dashboard.error") }}
      </UiText>
      <UiText
        variant="xs"
        class="min-w-0 flex-1 truncate text-left"
      >
        {{ entry.method }} {{ entry.url }}
      </UiText>
      <UiText
        variant="caption"
        muted
      >
        {{
          i18n.t("spaces.http.collection.dashboard.duration", {
            value: entry.durationMs,
          })
        }}
      </UiText>
      <UiText
        variant="caption"
        muted
      >
        {{ new Date(entry.requestedAt).toLocaleString() }}
      </UiText>
    </Button>
    <div
      v-if="expanded"
      class="px-3 py-2"
    >
      <UiText
        v-if="loading || failed || !snapshot"
        variant="xs"
        muted
      >
        {{
          i18n.t(
            `spaces.http.history.${loading ? "loading" : failed ? "failed" : "unavailable"}`,
          )
        }}
      </UiText>
      <div
        v-else
        class="flex h-80 min-h-0 flex-col"
      >
        <HttpHistorySnapshot :snapshot="snapshot" />
      </div>
    </div>
  </div>
</template>
