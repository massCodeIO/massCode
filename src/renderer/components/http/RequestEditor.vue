<script setup lang="ts">
import type { HttpMethod } from '~/main/types/http'
import * as Select from '@/components/ui/shadcn/select'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useHttpExecute, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import {
  getEntryNameConflictMessage,
  getEntryNameValidationMessage,
} from '@/utils'
import { LoaderCircle, Send } from 'lucide-vue-next'
import { getEntryNameValidationIssue } from '~/shared/entryNameValidation'

const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]

const {
  currentDraft,
  currentRequest,
  hasSiblingRequestNameConflict,
  saveCurrentRequest,
} = useHttpRequests()
const { executeCurrentRequest, isExecuting } = useHttpExecute()

const activeTab = ref<'params' | 'headers' | 'body' | 'auth' | 'description'>(
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

const isNameFocused = ref(false)

const hasNameConflict = computed(() => {
  if (!currentDraft.value || !currentRequest.value)
    return false
  if (getEntryNameValidationIssue(currentDraft.value.name))
    return false
  if (
    currentDraft.value.name.trim().toLowerCase()
    === currentRequest.value.name.toLowerCase()
  ) {
    return false
  }
  return hasSiblingRequestNameConflict(
    currentDraft.value.name,
    currentRequest.value.id,
    currentDraft.value.folderId,
  )
})

const nameValidationMessage = computed(() => {
  if (!currentDraft.value)
    return ''
  const issueMessage = getEntryNameValidationMessage(
    currentDraft.value.name,
    i18n.t.bind(i18n),
  )
  if (issueMessage)
    return issueMessage
  if (hasNameConflict.value)
    return getEntryNameConflictMessage('request', i18n.t.bind(i18n))
  return ''
})

const isNameValidationTooltipOpen = computed(
  () => isNameFocused.value && Boolean(nameValidationMessage.value),
)

function onNameFocus() {
  isNameFocused.value = true
}

function onNameBlur() {
  if (
    currentDraft.value
    && currentRequest.value
    && (getEntryNameValidationIssue(currentDraft.value.name)
      || hasNameConflict.value)
  ) {
    currentDraft.value.name = currentRequest.value.name
  }
  isNameFocused.value = false
}

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
    <div
      class="border-border grid grid-cols-[1fr_auto] items-center border-b px-2 pb-1"
    >
      <div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <div class="min-w-0 flex-1">
          <UiInputValidationTooltip
            :open="isNameValidationTooltipOpen"
            :message="nameValidationMessage"
          >
            <UiInput
              v-model="currentDraft.name"
              variant="ghost"
              class="w-full truncate px-0"
              :placeholder="i18n.t('spaces.http.editor.namePlaceholder')"
              @focus="onNameFocus"
              @blur="onNameBlur"
            />
          </UiInputValidationTooltip>
        </div>
      </div>
      <div class="flex h-7 items-center" />
    </div>
    <div class="border-border flex items-center gap-1 border-b px-2 py-1">
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
      <div class="min-w-0 flex-1">
        <HttpVariableInput
          v-model="currentDraft.url"
          :placeholder="i18n.t('spaces.http.editor.urlPlaceholder')"
        />
      </div>
      <UiActionButton
        :tooltip="i18n.t('spaces.http.editor.send')"
        :disabled="isExecuting || !currentDraft.url"
        @click="onSend"
      >
        <LoaderCircle
          v-if="isExecuting"
          class="animate-spin"
        />
        <Send v-else />
      </UiActionButton>
    </div>
    <Tabs.Tabs
      v-model="activeTab"
      class="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div
        class="border-border flex items-center justify-between border-b px-2 py-1"
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
          <Tabs.TabsTrigger value="description">
            {{ i18n.t("spaces.http.editor.tabs.description") }}
          </Tabs.TabsTrigger>
        </Tabs.TabsList>
      </div>
      <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <Tabs.TabsContent value="params">
          <HttpKeyValueTable v-model="currentDraft.query" />
        </Tabs.TabsContent>
        <Tabs.TabsContent value="headers">
          <HttpKeyValueTable v-model="currentDraft.headers" />
        </Tabs.TabsContent>
        <Tabs.TabsContent value="body">
          <HttpRequestBodyTab v-model="currentDraft" />
        </Tabs.TabsContent>
        <Tabs.TabsContent value="auth">
          <HttpRequestAuthTab v-model="currentDraft" />
        </Tabs.TabsContent>
        <Tabs.TabsContent value="description">
          <HttpRequestDescriptionTab v-model="currentDraft" />
        </Tabs.TabsContent>
      </div>
    </Tabs.Tabs>
  </div>
</template>
