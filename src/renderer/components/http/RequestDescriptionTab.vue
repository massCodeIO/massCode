<script setup lang="ts">
import type { HttpRequestDraft } from '@/composables'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { i18n } from '@/electron'

const draft = defineModel<HttpRequestDraft>({ required: true })
</script>

<template>
  <Textarea
    v-model="draft.description"
    class="min-h-40"
    :placeholder="i18n.t('spaces.http.editor.description.placeholder')"
  />
</template>
