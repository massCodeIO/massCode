<script setup lang="ts">
import { useSnippets, useSnippetUpdate } from '@/composables'

const show = defineModel<boolean>('show')

const { selectedSnippet } = useSnippets()
const { addToUpdateQueue } = useSnippetUpdate()

const description = computed({
  get() {
    return selectedSnippet.value?.description || ''
  },
  set(v: string) {
    addToUpdateQueue(selectedSnippet.value!.id, {
      name: selectedSnippet.value!.name,
      description: v,
      folderId: selectedSnippet.value!.folder?.id || null,
      isDeleted: selectedSnippet.value!.isDeleted,
      isFavorites: selectedSnippet.value!.isFavorites,
    })
  },
})

watch(selectedSnippet, () => {
  if (show.value) {
    show.value = false
  }
})
</script>

<template>
  <div
    v-if="selectedSnippet?.description || show"
    data-editor-description
    class="border-border border-b px-2"
  >
    <UiInput
      v-model="description"
      variant="ghost"
      type="textarea"
      :focus="show"
      :rows="2"
      class="max-h-28 px-0"
    />
  </div>
</template>
