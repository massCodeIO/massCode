<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useCopyToClipboard, useHttpExecute } from '@/composables'
import { i18n } from '@/electron'
import { Copy, LoaderCircle } from 'lucide-vue-next'

const { lastResponse, lastError, isExecuting } = useHttpExecute()
const copy = useCopyToClipboard()

const activeTab = ref<'body' | 'headers'>('body')

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

const formattedBody = computed(() => {
  const response = lastResponse.value
  if (!response)
    return ''
  if (response.bodyKind === 'binary')
    return ''
  if (response.bodyKind === 'json') {
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2)
    }
    catch {
      return response.body
    }
  }
  return response.body
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

function copyBody() {
  if (formattedBody.value)
    copy(formattedBody.value)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="isExecuting"
      class="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-sm"
    >
      <LoaderCircle class="size-4 animate-spin" />
      {{ i18n.t("spaces.http.editor.response.executing") }}
    </div>
    <div
      v-else-if="!lastResponse"
      class="flex flex-1 items-center justify-center"
    >
      <UiText class="text-muted-foreground text-sm">
        {{ i18n.t("spaces.http.editor.response.empty") }}
      </UiText>
    </div>
    <div
      v-else
      class="flex min-h-0 flex-1 flex-col"
    >
      <div
        class="border-border flex items-center gap-4 border-b px-3 py-1.5 text-xs"
      >
        <div class="flex items-center gap-1">
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

      <div
        v-if="lastError"
        class="border-border bg-destructive/10 text-destructive border-b px-3 py-1.5 text-xs"
      >
        {{ i18n.t("spaces.http.editor.response.error") }}: {{ lastError }}
      </div>

      <Tabs.Tabs
        v-model="activeTab"
        class="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div
          class="border-border flex items-center justify-between border-b px-3 py-1"
        >
          <Tabs.TabsList>
            <Tabs.TabsTrigger value="body">
              {{ i18n.t("spaces.http.editor.response.tabs.body") }}
            </Tabs.TabsTrigger>
            <Tabs.TabsTrigger value="headers">
              {{ i18n.t("spaces.http.editor.response.tabs.headers") }}
              <span
                v-if="lastResponse.headers.length"
                class="bg-muted text-muted-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums"
              >
                {{ lastResponse.headers.length }}
              </span>
            </Tabs.TabsTrigger>
          </Tabs.TabsList>
          <Button
            v-if="activeTab === 'body' && formattedBody"
            variant="ghost"
            size="sm"
            class="h-6 gap-1 px-2 text-xs"
            @click="copyBody"
          >
            <Copy class="size-3" />
            {{ i18n.t("spaces.http.editor.response.copy") }}
          </Button>
        </div>

        <div class="scrollbar min-h-0 flex-1 overflow-auto">
          <Tabs.TabsContent
            value="body"
            class="m-0"
          >
            <div
              v-if="lastResponse.bodyKind === 'binary'"
              class="text-muted-foreground p-3 text-xs"
            >
              {{ i18n.t("spaces.http.editor.response.binaryNotice") }}
            </div>
            <pre
              v-else
              class="px-3 py-2 font-mono text-xs whitespace-pre-wrap"
            >{{ formattedBody }}</pre>
          </Tabs.TabsContent>
          <Tabs.TabsContent
            value="headers"
            class="m-0"
          >
            <div class="flex flex-col">
              <div
                v-for="(header, index) in lastResponse.headers"
                :key="index"
                class="border-border grid grid-cols-[1fr_2fr] gap-2 border-b px-3 py-1.5 text-xs"
              >
                <span class="text-muted-foreground font-mono">{{
                  header.key
                }}</span>
                <span class="font-mono break-all">{{ header.value }}</span>
              </div>
            </div>
          </Tabs.TabsContent>
        </div>
      </Tabs.Tabs>
    </div>
  </div>
</template>
