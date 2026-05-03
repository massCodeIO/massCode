<script setup lang="ts">
import { i18n } from '@/electron'

defineProps<{
  content: string
}>()
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
    <HttpRequestPreviewCode
      v-else
      class="min-h-0 flex-1"
      :content="content"
    />
  </div>
</template>
