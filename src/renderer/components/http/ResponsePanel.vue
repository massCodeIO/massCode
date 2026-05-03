<script setup lang="ts">
import * as Tabs from '@/components/ui/shadcn/tabs'
import {
  useCopyToClipboard,
  useDonations,
  useHttpExecute,
} from '@/composables'
import { i18n } from '@/electron'
import { Copy, LoaderCircle } from 'lucide-vue-next'

const { lastResponse, lastError, isExecuting } = useHttpExecute()
const copy = useCopyToClipboard()
const { incrementCopy } = useDonations()

const activeTab = ref<'body' | 'headers'>('body')

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

const formattedHeaders = computed(() => {
  const response = lastResponse.value
  if (!response)
    return ''

  return response.headers
    .map(header => `${header.key}: ${header.value}`)
    .join('\n')
})

const copyValue = computed(() => {
  return activeTab.value === 'headers'
    ? formattedHeaders.value
    : formattedBody.value
})

const bodyViewerLanguage = computed(() => {
  return lastResponse.value?.bodyKind === 'json' ? 'json' : 'plain'
})

function copyActiveTab() {
  if (copyValue.value) {
    copy(copyValue.value)
    incrementCopy('http')
  }
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
          <UiActionButton
            v-if="copyValue"
            :tooltip="i18n.t('spaces.http.editor.response.copy')"
            @click="copyActiveTab"
          >
            <Copy class="size-4" />
          </UiActionButton>
        </div>

        <div class="min-h-0 flex-1">
          <Tabs.TabsContent
            value="body"
            class="m-0 h-full"
          >
            <div
              v-if="lastResponse.bodyKind === 'binary'"
              class="text-muted-foreground p-3 text-xs"
            >
              {{ i18n.t("spaces.http.editor.response.binaryNotice") }}
            </div>
            <HttpCodeViewer
              v-else
              :content="formattedBody"
              :language="bodyViewerLanguage"
            />
          </Tabs.TabsContent>
          <Tabs.TabsContent
            value="headers"
            class="scrollbar m-0 h-full overflow-auto"
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
