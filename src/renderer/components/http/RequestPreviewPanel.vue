<script setup lang="ts">
import type { HttpRequestPreviewFormat } from './requestPreview'
import { i18n } from '@/electron'

const props = defineProps<{
  content: string
  format: HttpRequestPreviewFormat
  wrapLines?: boolean
  pending?: boolean
}>()

const viewerLanguage = computed(() => {
  if (props.format === 'fetch' || props.format === 'axios')
    return 'javascript'
  if (props.format === 'curl')
    return 'shell'
  const target = props.format.split(':')[0]
  return target === 'node'
    ? 'javascript'
    : target === 'objc'
      ? 'objective-c'
      : target
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      v-if="!content && !pending"
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
      :wrap-lines="props.wrapLines"
    />
  </div>
</template>
