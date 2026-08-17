<script setup lang="ts">
import { useSnippets, useSnippetUpdate } from '@/composables'

const show = defineModel<boolean>('show')

const { displayedSnippet, selectedSnippet, selectedSnippetRecordStatus }
  = useSnippets()
const { addToUpdateQueue } = useSnippetUpdate()

const description = computed({
  get() {
    return displayedSnippet.value?.description || ''
  },
  set(v: string) {
    if (
      selectedSnippetRecordStatus.value !== 'ready'
      || !selectedSnippet.value
      || selectedSnippet.value.id !== displayedSnippet.value?.id
    ) {
      return
    }

    addToUpdateQueue(selectedSnippet.value!.id, {
      name: selectedSnippet.value!.name,
      description: v,
      folderId: selectedSnippet.value!.folder?.id || null,
      isDeleted: selectedSnippet.value!.isDeleted,
      isFavorites: selectedSnippet.value!.isFavorites,
    })
  },
})

watch(displayedSnippet, () => {
  if (show.value) {
    show.value = false
  }
})
</script>

<template>
  <div
    v-if="displayedSnippet?.description || show"
    data-editor-description
    class="border-border border-b"
  >
    <UiTextarea
      v-model="description"
      :focus="show"
      variant="ghost"
    />
  </div>
</template>
