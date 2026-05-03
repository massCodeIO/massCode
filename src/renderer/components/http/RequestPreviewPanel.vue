<script setup lang="ts">
import type { HttpRequestPreviewFormat } from './requestPreview'
import { i18n } from '@/electron'

const props = defineProps<{
  content: string
  format: HttpRequestPreviewFormat
}>()

const viewerLanguage = computed(() => {
  return props.format === 'http' ? 'http' : 'shell'
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      v-if="!content"
      class="flex flex-1 items-center justify-center"
    >
      <UiText class="text-muted-foreground text-sm">
        {{ i18n.t("spaces.http.editor.preview.empty") }}
      </UiText>
    </div>
    <HttpCodeViewer
      v-else
      class="min-h-0 flex-1"
      :content="content"
      :language="viewerLanguage"
    />
  </div>
</template>
