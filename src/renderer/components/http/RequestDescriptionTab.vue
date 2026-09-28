<script setup lang="ts">
import type { HttpRequestDraft } from '@/composables'

const draft = defineModel<HttpRequestDraft>({ required: true })
const description = computed({
  get: () => draft.value.description ?? '',
  set: (value: string) => {
    draft.value.description = value
  },
})
</script>

<template>
  <NotesEditor v-model:content="description" />
</template>
