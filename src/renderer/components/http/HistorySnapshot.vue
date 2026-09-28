<script setup lang="ts">
import type { HttpHistorySnapshot } from '~/shared/httpHistory'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { i18n } from '@/electron'

const props = defineProps<{ snapshot: HttpHistorySnapshot }>()
const activeTab = ref('response')
const content = computed(() => {
  const data = props.snapshot
  if (activeTab.value === 'request')
    return `${data.request.method} ${data.request.url}\n${data.request.headers.map(h => `${h.key}: ${h.value}`).join('\n')}\n\n${data.request.body}`
  return `${data.response.status ?? ''}\n${data.response.headers.map(h => `${h.key}: ${h.value}`).join('\n')}\n\n${data.response.error ?? data.response.body}`
})
const truncated = computed(() =>
  activeTab.value === 'request'
    ? props.snapshot.request.truncated
    : props.snapshot.response.truncated,
)
</script>

<template>
  <Tabs.Tabs
    v-model="activeTab"
    class="flex min-h-0 flex-1 flex-col"
  >
    <Tabs.TabsList class="self-start">
      <Tabs.TabsTrigger value="request">
        {{ i18n.t("spaces.http.history.request") }}
      </Tabs.TabsTrigger>
      <Tabs.TabsTrigger value="response">
        {{ i18n.t("spaces.http.history.response") }}
      </Tabs.TabsTrigger>
    </Tabs.TabsList>
    <UiText
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.history.masked") }}
    </UiText>
    <UiText
      v-if="truncated"
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.history.truncated") }}
    </UiText>
    <UiText
      v-if="
        activeTab === 'response'
          && props.snapshot.response.bodyKind === 'binary'
      "
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.history.binary") }}
    </UiText>
    <div class="min-h-0 flex-1 overflow-hidden">
      <HttpCodeViewer
        :content="content"
        language="http"
      />
    </div>
  </Tabs.Tabs>
</template>
