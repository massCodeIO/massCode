<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Card from '@/components/ui/shadcn/card'
import { useHttpCollection } from '@/composables/spaces/http/useHttpCollection'
import { flattenFolderTree } from '@/composables/spaces/http/useHttpFolderTree'
import { useHttpHistory } from '@/composables/spaces/http/useHttpHistory'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { useDateFormat } from '@/composables/useDateFormat'
import { i18n } from '@/electron'
import { Clock3, Folder, History, Send } from 'lucide-vue-next'

const { formatDateTime } = useDateFormat()

const { collection } = useHttpCollection()
const { allRequests } = useHttpRequests()
const {
  openHistory,
  history,
  loading,
  loadError: failed,
  getHttpHistory,
} = useHttpHistory()
const { view, folderId } = useHttpRunner()
const folderIds = computed(
  () =>
    new Set(
      collection.value
        ? flattenFolderTree([collection.value]).map(folder => folder.id)
        : [],
    ),
)
const requests = computed(() =>
  allRequests.value.filter(
    request =>
      request.folderId !== null
      && folderIds.value.has(request.folderId)
      && !request.isDeleted,
  ),
)
const methods = computed(() => {
  const counts = new Map<string, number>()
  requests.value.forEach((request) => {
    const method = request.protocol === 'websocket' ? 'WS' : request.method
    counts.set(method, (counts.get(method) ?? 0) + 1)
  })
  return [...counts].sort(([a], [b]) => a.localeCompare(b))
})
const recent = computed(() => {
  const byId = new Map(requests.value.map(request => [request.id, request]))
  return history.value
    .filter(item => item.requestId !== null && byId.has(item.requestId))
    .toSorted((a, b) => b.requestedAt - a.requestedAt || b.id - a.id)
    .slice(0, 5)
    .map(item => ({ ...item, name: byId.get(item.requestId!)!.name }))
})
const lastRun = computed(() =>
  folderId.value === collection.value?.id
  && view.value
  && ['passed', 'failed', 'cancelled'].includes(view.value.state)
    ? view.value
    : null,
)
const passed = computed(
  () =>
    lastRun.value?.steps.filter(step => step.state === 'passed').length ?? 0,
)

watch(
  () => collection.value?.id,
  () => {
    void getHttpHistory()
  },
  { immediate: true },
)

function date(value: number) {
  return formatDateTime(value)
}
</script>

<template>
  <div
    v-if="collection"
    class="@container h-full min-h-0"
  >
    <div
      class="scrollbar grid h-full min-h-0 grid-rows-[minmax(384px,1fr)_auto] gap-3 overflow-auto @min-[640px]:grid-cols-[3fr_2fr] @min-[640px]:grid-rows-[minmax(0,1fr)] @min-[640px]:overflow-hidden"
    >
      <div class="min-h-0 min-w-0 overflow-hidden">
        <HttpCollectionDescription />
      </div>
      <div
        class="scrollbar min-h-0 min-w-0 space-y-3 @min-[640px]:overflow-auto"
      >
        <div class="grid grid-cols-2 gap-3">
          <Card.Card class="min-w-0 overflow-hidden">
            <Card.CardHeader class="border-b px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <UiText
                  as="h3"
                  variant="sm"
                  weight="medium"
                >
                  {{ i18n.t("spaces.http.collection.dashboard.requests") }}
                </UiText>
                <Send class="text-muted-foreground size-4 shrink-0" />
              </div>
            </Card.CardHeader>
            <Card.CardContent class="space-y-3 px-3 py-5">
              <UiText
                as="div"
                variant="xl"
                weight="semibold"
                class="tabular-nums"
              >
                {{ requests.length }}
              </UiText>
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                <UiText
                  v-for="[method, count] in methods"
                  :key="method"
                  variant="caption"
                  muted
                >
                  {{ method }}
                  <UiText
                    variant="caption"
                    weight="medium"
                  >
                    {{ count }}
                  </UiText>
                </UiText>
              </div>
            </Card.CardContent>
          </Card.Card>
          <Card.Card class="min-w-0 overflow-hidden">
            <Card.CardHeader class="border-b px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <UiText
                  as="h3"
                  variant="sm"
                  weight="medium"
                >
                  {{ i18n.t("spaces.http.collection.dashboard.folders") }}
                </UiText>
                <Folder class="text-muted-foreground size-4 shrink-0" />
              </div>
            </Card.CardHeader>
            <Card.CardContent class="space-y-3 px-3 py-5">
              <UiText
                as="div"
                variant="xl"
                weight="semibold"
                class="tabular-nums"
              >
                {{ folderIds.size - 1 }}
              </UiText>
            </Card.CardContent>
          </Card.Card>
          <Card.Card class="col-span-2 min-w-0 overflow-hidden">
            <Card.CardHeader class="border-b px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <UiText
                  as="h3"
                  variant="sm"
                  weight="medium"
                >
                  {{ i18n.t("spaces.http.collection.dashboard.lastRun") }}
                </UiText>
                <Clock3 class="text-muted-foreground size-4 shrink-0" />
              </div>
            </Card.CardHeader>
            <Card.CardContent class="space-y-3 px-3 py-5">
              <div
                v-if="lastRun"
                class="space-y-2"
              >
                <UiText
                  as="div"
                  variant="lg"
                  weight="medium"
                  :class="{
                    'text-destructive': lastRun.state === 'failed',
                    'text-success': lastRun.state === 'passed',
                  }"
                >
                  {{ i18n.t(`spaces.http.runner.states.${lastRun.state}`) }}
                </UiText>
                <div class="flex flex-wrap gap-x-3 gap-y-1">
                  <UiText
                    variant="xs"
                    muted
                  >
                    {{
                      lastRun.environmentName
                        ?? i18n.t("spaces.http.environments.none")
                    }}
                  </UiText>
                  <UiText
                    variant="xs"
                    muted
                  >
                    {{
                      i18n.t("spaces.http.collection.dashboard.passed", {
                        count: passed,
                        total: lastRun.steps.length,
                      })
                    }}
                  </UiText>
                </div>
              </div>
              <UiText
                v-else
                as="p"
                variant="xs"
                muted
              >
                {{ i18n.t("spaces.http.collection.dashboard.noRun") }}
              </UiText>
            </Card.CardContent>
          </Card.Card>
        </div>
        <Card.Card class="min-w-0 overflow-hidden">
          <Card.CardHeader class="border-b px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <UiText
                as="h3"
                variant="sm"
                weight="medium"
              >
                {{ i18n.t("spaces.http.collection.dashboard.recent") }}
              </UiText>
              <History class="text-muted-foreground size-4 shrink-0" />
            </div>
          </Card.CardHeader>
          <Card.CardContent class="p-2">
            <UiText
              v-if="loading || failed || !recent.length"
              as="p"
              variant="xs"
              muted
              class="px-1 py-3"
            >
              {{
                i18n.t(
                  `spaces.http.collection.dashboard.${loading ? "loading" : failed ? "loadFailed" : "noHistory"}`,
                )
              }}
            </UiText>
            <div
              v-else
              class="divide-y"
            >
              <Button
                v-for="item in recent"
                :key="item.id"
                variant="ghost"
                class="h-auto w-full flex-col items-stretch gap-1 px-2 py-2 text-left"
                @click="openHistory(item)"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <UiText
                    variant="caption"
                    mono
                    class="w-12 shrink-0"
                  >
                    {{ item.method }}
                  </UiText>
                  <UiText
                    variant="sm"
                    class="min-w-0 flex-1 truncate"
                  >
                    {{ item.name }}
                  </UiText>
                  <UiText
                    variant="xs"
                    mono
                    :class="{
                      'text-destructive':
                        !!item.error || (item.status ?? 0) >= 400,
                    }"
                  >
                    {{
                      item.status
                        ?? i18n.t("spaces.http.collection.dashboard.error")
                    }}
                  </UiText>
                </div>
                <div
                  class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                >
                  <UiText
                    variant="caption"
                    muted
                  >
                    {{ date(item.requestedAt) }}
                  </UiText>
                  <UiText
                    variant="caption"
                    muted
                  >
                    {{
                      i18n.t("spaces.http.collection.dashboard.duration", {
                        value: item.durationMs,
                      })
                    }}
                  </UiText>
                </div>
              </Button>
            </div>
          </Card.CardContent>
        </Card.Card>
      </div>
    </div>
  </div>
</template>
