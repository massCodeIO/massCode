<script setup lang="ts">
import type { HttpRequestPreviewFormat } from '~/shared/httpPreview'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { i18n } from '@/electron'
import { HTTP_PREVIEW_TARGETS } from '~/shared/httpPreview'

const model = defineModel<HttpRequestPreviewFormat>({ required: true })
const clients = computed(
  () =>
    HTTP_PREVIEW_TARGETS.find(target =>
      target.clients.some(client => client.id === model.value),
    )!.clients,
)
</script>

<template>
  <Tabs.Tabs
    v-if="clients.length > 1"
    v-model="model"
    class="shrink-0"
  >
    <Tabs.TabsList>
      <Tabs.TabsTrigger
        v-for="client in clients"
        :key="client.id"
        :value="client.id"
      >
        {{
          i18n.t(
            `spaces.http.editor.preview.clients.${client.id.replace(":", "_")}`,
          )
        }}
      </Tabs.TabsTrigger>
    </Tabs.TabsList>
  </Tabs.Tabs>
</template>
