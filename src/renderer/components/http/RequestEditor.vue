<script setup lang="ts">
import type { HttpMethod } from '~/main/types/http'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useHttpExecute, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { LoaderCircle, Save, Send } from 'lucide-vue-next'

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
  isCurrentRequestDirty,
  saveCurrentRequest,
} = useHttpRequests()
const { executeCurrentRequest, isExecuting } = useHttpExecute()

const activeTab = ref<'params' | 'headers' | 'body' | 'auth' | 'description'>(
  'params',
)

async function onSend() {
  await saveCurrentRequest()
  await executeCurrentRequest()
}

async function onSave() {
  await saveCurrentRequest()
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
    <div class="border-border flex items-center gap-2 border-b px-2 py-2">
      <Select.Select v-model="currentDraft.method">
        <Select.SelectTrigger class="!h-8 w-24">
          <Select.SelectValue>
            <HttpMethodBadge :method="currentDraft.method" />
          </Select.SelectValue>
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="m in HTTP_METHODS"
            :key="m"
            :value="m"
          >
            <HttpMethodBadge :method="m" />
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
      <UiInput
        v-model="currentDraft.url"
        class="!h-8 flex-1"
        :placeholder="i18n.t('spaces.http.editor.urlPlaceholder')"
      />
      <Button
        size="sm"
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
        {{ i18n.t("spaces.http.editor.send") }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        :disabled="!isCurrentRequestDirty"
        @click="onSave"
      >
        <Save class="size-3.5" />
        {{ i18n.t("spaces.http.editor.save") }}
      </Button>
    </div>
    <Tabs.Tabs
      v-model="activeTab"
      class="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div class="border-border border-b px-2 py-1">
        <Tabs.TabsList>
          <Tabs.TabsTrigger value="params">
            {{ i18n.t("spaces.http.editor.tabs.params") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="headers">
            {{ i18n.t("spaces.http.editor.tabs.headers") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="body">
            {{ i18n.t("spaces.http.editor.tabs.body") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="auth">
            {{ i18n.t("spaces.http.editor.tabs.auth") }}
          </Tabs.TabsTrigger>
          <Tabs.TabsTrigger value="description">
            {{ i18n.t("spaces.http.editor.tabs.description") }}
          </Tabs.TabsTrigger>
        </Tabs.TabsList>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
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
        <Tabs.TabsContent value="description">
          <UiText class="text-muted-foreground text-xs">
            {{ i18n.t("spaces.http.editor.tabs.description") }}: TODO
          </UiText>
        </Tabs.TabsContent>
      </div>
    </Tabs.Tabs>
  </div>
</template>
