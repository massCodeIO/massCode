<script setup lang="ts">
import type { HttpRequestPreviewFormat } from '~/shared/httpPreview'
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'
import { HTTP_PREVIEW_TARGETS } from '~/shared/httpPreview'

const model = defineModel<HttpRequestPreviewFormat>({ required: true })
const language = computed({
  get: () =>
    HTTP_PREVIEW_TARGETS.find(target =>
      target.clients.some(client => client.id === model.value),
    )!.id,
  set: (id) => {
    const next = HTTP_PREVIEW_TARGETS.find(target => target.id === id)
    if (next)
      model.value = next.clients[0].id
  },
})
</script>

<template>
  <Select.Select v-model="language">
    <Select.SelectTrigger
      class="w-32"
      :aria-label="i18n.t('spaces.http.editor.preview.language')"
    >
      <Select.SelectValue />
    </Select.SelectTrigger>
    <Select.SelectContent>
      <Select.SelectItem
        v-for="item in HTTP_PREVIEW_TARGETS"
        :key="item.id"
        :value="item.id"
      >
        {{ i18n.t(`spaces.http.editor.preview.languages.${item.id}`) }}
      </Select.SelectItem>
    </Select.SelectContent>
  </Select.Select>
</template>
