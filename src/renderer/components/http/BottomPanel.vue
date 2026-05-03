<script setup lang="ts">
import type { HttpRequestPreviewFormat } from './requestPreview'
import * as Select from '@/components/ui/shadcn/select'
import * as Tabs from '@/components/ui/shadcn/tabs'
import {
  useCopyToClipboard,
  useDonations,
  useHttpEnvironments,
  useHttpExecute,
  useHttpRequests,
} from '@/composables'
import { i18n } from '@/electron'
import { Copy } from 'lucide-vue-next'
import { buildRequestPreview } from './requestPreview'

type BottomPanelTab = 'preview' | 'response'

const { currentDraft } = useHttpRequests()
const { activeEnvironment } = useHttpEnvironments()
const { isExecuting, lastError, lastResponse } = useHttpExecute()
const copy = useCopyToClipboard()
const { incrementCopy } = useDonations()

const activeTab = ref<BottomPanelTab>('preview')
const previewFormat = ref<HttpRequestPreviewFormat>('http')

const previewVariables = computed<Record<string, string>>(() => {
  return (activeEnvironment.value?.variables as Record<string, string>) ?? {}
})

const previewContent = computed(() => {
  if (!currentDraft.value)
    return ''
  return buildRequestPreview(currentDraft.value, previewFormat.value, {
    variables: previewVariables.value,
  })
})

const statusClass = computed(() => {
  const status = lastResponse.value?.status
  if (!status)
    return 'text-muted-foreground'
  if (status >= 200 && status < 300)
    return 'text-green-500'
  if (status >= 300 && status < 400)
    return 'text-blue-500'
  if (status >= 400 && status < 500)
    return 'text-yellow-500'
  return 'text-red-500'
})

function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDuration(ms: number): string {
  if (ms < 1000)
    return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

watch(lastResponse, (response, previous) => {
  if (response && response !== previous) {
    activeTab.value = 'response'
  }
})

watch(isExecuting, (executing) => {
  if (executing) {
    activeTab.value = 'response'
  }
})

watch(lastError, (error) => {
  if (error) {
    activeTab.value = 'response'
  }
})

function copyPreview() {
  if (previewContent.value) {
    copy(previewContent.value)
    incrementCopy('http')
  }
}
</script>

<template>
  <Tabs.Tabs
    v-model="activeTab"
    class="flex h-full min-h-0 flex-col gap-0"
  >
    <div
      class="border-border flex items-center justify-between border-b px-3 py-1"
    >
      <Tabs.TabsList>
        <Tabs.TabsTrigger value="preview">
          {{ i18n.t("spaces.http.editor.panels.preview") }}
        </Tabs.TabsTrigger>
        <Tabs.TabsTrigger value="response">
          {{ i18n.t("spaces.http.editor.panels.response") }}
        </Tabs.TabsTrigger>
      </Tabs.TabsList>

      <div
        v-if="activeTab === 'preview'"
        class="flex items-center gap-1"
      >
        <Select.Select v-model="previewFormat">
          <Select.SelectTrigger class="w-24">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="http">
              {{ i18n.t("spaces.http.editor.preview.formats.http") }}
            </Select.SelectItem>
            <Select.SelectItem value="curl">
              {{ i18n.t("spaces.http.editor.preview.formats.curl") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>

        <UiActionButton
          :tooltip="i18n.t('spaces.http.editor.response.copy')"
          :disabled="!previewContent"
          @click="copyPreview"
        >
          <Copy class="size-4" />
        </UiActionButton>
      </div>

      <div
        v-else-if="activeTab === 'response' && lastResponse"
        class="flex min-w-0 items-center gap-4 text-xs"
      >
        <div class="flex min-w-0 items-center gap-1">
          <span class="text-muted-foreground">
            {{ i18n.t("spaces.http.editor.response.status") }}:
          </span>
          <span
            class="font-mono font-semibold"
            :class="statusClass"
          >
            {{ lastResponse.status ?? "-" }}
            <template v-if="lastResponse.statusText">
              {{ lastResponse.statusText }}
            </template>
          </span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">
            {{ i18n.t("spaces.http.editor.response.time") }}:
          </span>
          <span class="font-mono">{{
            formatDuration(lastResponse.durationMs)
          }}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">
            {{ i18n.t("spaces.http.editor.response.size") }}:
          </span>
          <span class="font-mono">{{
            formatSize(lastResponse.sizeBytes)
          }}</span>
        </div>
        <span
          v-if="lastResponse.truncated"
          class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
        >
          {{ i18n.t("spaces.http.editor.response.truncated") }}
        </span>
      </div>
    </div>

    <div class="min-h-0 flex-1">
      <Tabs.TabsContent
        value="preview"
        class="m-0 h-full"
      >
        <HttpRequestPreviewPanel
          :content="previewContent"
          :format="previewFormat"
        />
      </Tabs.TabsContent>
      <Tabs.TabsContent
        value="response"
        class="m-0 h-full"
      >
        <HttpResponsePanel />
      </Tabs.TabsContent>
    </div>
  </Tabs.Tabs>
</template>
