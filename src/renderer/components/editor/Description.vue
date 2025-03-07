<script setup lang="ts">
import { useSnippets } from '@/composables'

const { selectedSnippet, updateSnippet } = useSnippets()

const description = computed({
  get() {
    return selectedSnippet.value?.description || ''
  },
  set(v: string) {
    updateSnippet(selectedSnippet.value!.id, {
      name: selectedSnippet.value!.name,
      description: v,
      folderId: selectedSnippet.value!.folder?.id || null,
      isDeleted: selectedSnippet.value!.isDeleted,
      isFavorites: selectedSnippet.value!.isFavorites,
    })
  },
})
</script>

<template>
  <div
    v-if="selectedSnippet?.description"
    data-editor-description
    class="border-border border-b px-2"
  >
    <UiInput
      v-model="description"
      variant="ghost"
      type="textarea"
      :rows="2"
      class="max-h-28 px-0"
    />
  </div>
</template>
