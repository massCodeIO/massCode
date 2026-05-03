<script setup lang="ts">
import type { HttpRequestPreviewFormat } from './requestPreview'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import * as Tabs from '@/components/ui/shadcn/tabs'
import {
  useCopyToClipboard,
  useHttpExecute,
  useHttpRequests,
} from '@/composables'
import { i18n } from '@/electron'
import { Copy } from 'lucide-vue-next'
import { buildRequestPreview } from './requestPreview'

type BottomPanelTab = 'preview' | 'response'

const { currentDraft } = useHttpRequests()
const { isExecuting, lastError, lastResponse } = useHttpExecute()
const copy = useCopyToClipboard()

const activeTab = ref<BottomPanelTab>('preview')
const previewFormat = ref<HttpRequestPreviewFormat>('http')

const previewContent = computed(() => {
  if (!currentDraft.value)
    return ''
  return buildRequestPreview(currentDraft.value, previewFormat.value)
})

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
          <Select.SelectTrigger class="h-6 w-24 text-xs">
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

        <Button
          variant="ghost"
          size="sm"
          class="h-6 gap-1 px-2 text-xs"
          :disabled="!previewContent"
          @click="copyPreview"
        >
          <Copy class="size-3" />
          {{ i18n.t("spaces.http.editor.response.copy") }}
        </Button>
      </div>
    </div>

    <div class="min-h-0 flex-1">
      <Tabs.TabsContent
        value="preview"
        class="m-0 h-full"
      >
        <HttpRequestPreviewPanel :content="previewContent" />
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
