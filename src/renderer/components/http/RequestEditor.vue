<script setup lang="ts">
import type { HttpMethod } from '~/main/types/http'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useHttpExecute, useHttpFolders, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { format } from 'date-fns'
import { LoaderCircle, Send } from 'lucide-vue-next'

const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]

const { currentDraft, currentRequest, saveCurrentRequest } = useHttpRequests()
const { folders, getFolderByIdFromTree } = useHttpFolders()
const { executeCurrentRequest, isExecuting } = useHttpExecute()

const activeTab = ref<'params' | 'headers' | 'body' | 'auth' | 'pre-request'>(
  'params',
)

const paramsCount = computed(() => currentDraft.value?.query.length ?? 0)
const headersCount = computed(() => currentDraft.value?.headers.length ?? 0)
const authIndicator = computed(() => {
  const type = currentDraft.value?.auth.type
  if (!type || type === 'none')
    return null
  return type
})

const folderName = computed(() => {
  if (!currentRequest.value)
    return null
  const folderId = currentRequest.value.folderId
  if (folderId === null)
    return i18n.t('common.inbox')
  return (
    getFolderByIdFromTree(folders.value, folderId)?.name
    ?? i18n.t('common.inbox')
  )
})

const updatedAtFormatted = computed(() => {
  if (!currentRequest.value)
    return null
  return format(new Date(currentRequest.value.updatedAt), 'dd.MM.yyyy')
})

async function onSend() {
  await saveCurrentRequest()
  await executeCurrentRequest()
}
</script>

<template>
  <div
    v-if="!currentRequest"
    class="text-muted-foreground flex h-full items-center justify-center"
  >
    {{ i18n.t("spaces.http.editor.noSelected") }}
  </div>
  <div
    v-else-if="currentDraft"
    class="flex h-full flex-col"
  >
    <div class="border-border flex items-center gap-2 border-b px-3 pb-1">
      <Select.Select v-model="currentDraft.method">
        <Select.SelectTrigger class="w-24">
          <Select.SelectValue>
            <HttpMethodBadge
              :method="currentDraft.method"
              size="sm"
            />
          </Select.SelectValue>
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="m in HTTP_METHODS"
            :key="m"
            :value="m"
          >
            <HttpMethodBadge
              :method="m"
              size="sm"
            />
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
      <div class="w-full">
        <UiInput
          v-model="currentDraft.url"
          class="flex-1 font-mono"
          :placeholder="i18n.t('spaces.http.editor.urlPlaceholder')"
        />
      </div>
      <Button
        :disabled="isExecuting || !currentDraft.url"
        @click="onSend"
      >
        <LoaderCircle
          v-if="isExecuting"
          class="size-3.5 animate-spin"
        />
        <Send
          v-else
          class="size-3.5"
        />
        <!-- {{ i18n.t("spaces.http.editor.send") }} -->
      </Button>
    </div>
    <Tabs.Tabs
      v-model="activeTab"
      class="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div
        class="border-border flex items-center justify-between border-b px-3 py-1"
      >
        <Tabs.TabsList>
          <Tabs.TabsTrigger value="params">
            {{ i18n.t("spaces.http.editor.tabs.params") }}
            <span
              v-if="paramsCount"
              class="bg-muted text-muted-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums"
            >
              {{ paramsCount }}
            </span>
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="headers">
            {{ i18n.t("spaces.http.editor.tabs.headers") }}
            <span
              v-if="headersCount"
              class="bg-muted text-muted-foreground ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums"
            >
              {{ headersCount }}
            </span>
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="body">
            {{ i18n.t("spaces.http.editor.tabs.body") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="auth">
            {{ i18n.t("spaces.http.editor.tabs.auth") }}
            <span
              v-if="authIndicator"
              class="bg-muted text-muted-foreground ml-1 inline-flex h-4 items-center justify-center rounded px-1.5 text-[10px] font-medium"
            >
              {{ authIndicator }}
            </span>
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="pre-request">
            {{ i18n.t("spaces.http.editor.tabs.preRequest") }}
          </Tabs.TabsTrigger>
        </Tabs.TabsList>
        <UiText
          variant="xs"
          muted
          class="flex shrink-0 items-center gap-1.5 px-1"
        >
          <span class="truncate">{{ folderName }}</span>
          <span>·</span>
          <span class="tabular-nums">{{ updatedAtFormatted }}</span>
        </UiText>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <Tabs.TabsContent value="params">
          <HttpKeyValueTable v-model="currentDraft.query" />
        </Tabs.TabsContent>
        <Tabs.TabsContent value="headers">
          <HttpKeyValueTable v-model="currentDraft.headers" />
        </Tabs.TabsContent>
        <Tabs.TabsContent value="body">
          <UiText class="text-muted-foreground text-xs">
            {{ i18n.t("spaces.http.editor.tabs.body") }}: TODO
          </UiText>
        </Tabs.TabsContent>
        <Tabs.TabsContent value="auth">
          <UiText class="text-muted-foreground text-xs">
            {{ i18n.t("spaces.http.editor.tabs.auth") }}: TODO
          </UiText>
        </Tabs.TabsContent>
        <Tabs.TabsContent value="pre-request">
          <UiText class="text-muted-foreground text-xs">
            {{ i18n.t("spaces.http.editor.tabs.preRequest") }}: TODO
          </UiText>
        </Tabs.TabsContent>
      </div>
    </Tabs.Tabs>
  </div>
</template>
