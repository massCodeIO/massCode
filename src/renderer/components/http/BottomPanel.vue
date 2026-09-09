<script setup lang="ts">
import type {
  HttpRequestPreviewFormat,
  HttpSnippetPayload,
} from '~/shared/httpPreview'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Tabs from '@/components/ui/shadcn/tabs'
import {
  useCopyToClipboard,
  useDonations,
  useHttpEnvironments,
  useHttpExecute,
  useHttpFolders,
  useHttpRequests,
  useHttpSettings,
} from '@/composables'
import { flattenFolderTree } from '@/composables/spaces/http/useHttpFolderTree'
import { useHttpHistory } from '@/composables/spaces/http/useHttpHistory'
import { i18n, ipc } from '@/electron'
import { Copy } from 'lucide-vue-next'
import { resolveHttpFolderConfig } from '~/shared/httpCollection'
import {
  buildHarRequest,
  buildRequestPreview,
  getRequestPreviewWarnings,
} from './requestPreview'

type BottomPanelTab = 'preview' | 'response' | 'history'

const { currentDraft, currentRequest } = useHttpRequests()
const { history, getHttpHistory } = useHttpHistory()
const historyCount = computed(
  () =>
    history.value.filter(
      entry => entry.requestId === currentRequest.value?.id,
    ).length,
)
onMounted(getHttpHistory)
const { folders } = useHttpFolders()
const { activeEnvironmentVariables } = useHttpEnvironments()
const { isExecuting, lastError, lastResponse } = useHttpExecute()
const { settings } = useHttpSettings()
const copy = useCopyToClipboard()
const { incrementCopy } = useDonations()

const activeTab = ref<BottomPanelTab>('preview')
const previewFormat = computed<HttpRequestPreviewFormat>({
  get: () => settings.defaultPreviewFormat,
  set: (value) => {
    settings.defaultPreviewFormat = value
  },
})

const previewContent = ref('')
const previewError = ref(false)
const previewErrorKey = ref('error')
const previewPending = ref(false)
const displayedFormat = ref(previewFormat.value)
const interpolateVariables = ref(true)

watch(
  [
    folders,
    currentDraft,
    previewFormat,
    activeEnvironmentVariables,
    interpolateVariables,
    currentRequest,
  ],
  async (_, __, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    if (!currentDraft.value?.url.trim()) {
      previewContent.value = ''
      previewError.value = false
      previewPending.value = false
      return
    }
    previewPending.value = true
    try {
      const options = {
        name: currentRequest.value?.name,
        collection: resolveHttpFolderConfig(
          flattenFolderTree(folders.value),
          currentRequest.value?.folderId,
        ),
        variables: interpolateVariables.value
          ? activeEnvironmentVariables.value
          : undefined,
      }
      const format = previewFormat.value
      const content
        = format === 'http'
          || format === 'curl'
          || format === 'fetch'
          || format === 'axios'
          ? buildRequestPreview(currentDraft.value, format, options)
          : await ipc.invoke<HttpSnippetPayload, string>(
            'spaces:http:generate-code',
            {
              request: buildHarRequest(currentDraft.value, options),
              format,
            },
          )
      if (!cancelled) {
        previewContent.value = content
        displayedFormat.value = format
        previewError.value = false
      }
    }
    catch (error) {
      if (!cancelled) {
        previewErrorKey.value
          = error instanceof Error
            && error.message.includes('HTTP_PREVIEW_MULTIPART_FILES_UNSUPPORTED')
            ? 'multipartFilesUnsupported'
            : error instanceof Error
              && error.message.includes('HTTP_PREVIEW_URL_TEMPLATE_UNSUPPORTED')
              ? 'urlTemplateUnsupported'
              : 'error'
        previewContent.value = ''
        previewError.value = true
      }
    }
    finally {
      if (!cancelled)
        previewPending.value = false
    }
  },
  { deep: true, immediate: true },
)

const previewWarnings = computed(() =>
  currentDraft.value
    ? getRequestPreviewWarnings(currentDraft.value, previewFormat.value)
    : [],
)

const statusClass = computed(() => {
  if (lastResponse.value?.graphql && lastResponse.value.graphql !== 'success')
    return 'text-destructive'
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
  if (settings.autoSwitchToResponse && response && response !== previous) {
    activeTab.value = 'response'
  }
})

watch(isExecuting, (executing) => {
  if (settings.autoSwitchToResponse && executing) {
    activeTab.value = 'response'
  }
})

watch(lastError, (error) => {
  if (settings.autoSwitchToResponse && error) {
    activeTab.value = 'response'
  }
})

function copyPreview() {
  if (previewContent.value && !previewPending.value) {
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
      class="border-border flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1"
    >
      <Tabs.TabsList>
        <Tabs.TabsTrigger value="preview">
          {{ i18n.t("spaces.http.editor.panels.preview") }}
        </Tabs.TabsTrigger>
        <Tabs.TabsTrigger value="response">
          {{ i18n.t("spaces.http.editor.panels.response") }}
        </Tabs.TabsTrigger>
        <Tabs.TabsTrigger value="history">
          {{ i18n.t("spaces.http.history.title") }}
          <HttpTabCount :count="historyCount" />
        </Tabs.TabsTrigger>
      </Tabs.TabsList>

      <div
        v-if="activeTab === 'preview'"
        class="flex flex-wrap items-center gap-1"
      >
        <HttpPreviewFormatSelect v-model="previewFormat" />
        <label class="flex items-center gap-2 px-2">
          <Checkbox v-model="interpolateVariables" />
          <UiText variant="xs">{{
            i18n.t("spaces.http.editor.preview.interpolate")
          }}</UiText>
        </label>

        <UiActionButton
          :tooltip="i18n.t('spaces.http.editor.response.copy')"
          :disabled="!previewContent || previewPending"
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
        class="m-0 flex h-full flex-col"
      >
        <HttpPreviewClientTabs
          v-model="previewFormat"
          class="border-border border-b px-3 py-2"
        />
        <UiText
          v-for="warning in previewWarnings"
          :key="warning"
          variant="caption"
          class="border-border border-b px-3 py-2"
        >
          {{ i18n.t(`spaces.http.editor.preview.warnings.${warning}`) }}
        </UiText>
        <UiText
          v-if="previewError"
          variant="caption"
          class="text-destructive px-3 py-2"
        >
          {{ i18n.t(`spaces.http.editor.preview.${previewErrorKey}`) }}
        </UiText>
        <HttpRequestPreviewPanel
          v-else
          class="min-h-0 flex-1"
          :content="previewContent"
          :format="displayedFormat"
          :pending="previewPending"
          :wrap-lines="settings.wrapLines"
        />
      </Tabs.TabsContent>
      <Tabs.TabsContent
        value="response"
        class="m-0 h-full"
      >
        <HttpResponsePanel />
      </Tabs.TabsContent>
      <Tabs.TabsContent
        value="history"
        class="scrollbar m-0 h-full overflow-auto px-3 py-2"
      >
        <HttpRequestHistory />
      </Tabs.TabsContent>
    </div>
  </Tabs.Tabs>
</template>
