<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
import { Plus } from 'lucide-vue-next'

const { selectedSnippet, updateSnippet } = useSnippets()
const { selectedSnippetContentIndex } = useApp()

const name = computed({
  get() {
    return selectedSnippet?.value?.name
  },
  set(v: string) {
    updateSnippet(selectedSnippet.value!.id, {
      name: v,
      description: selectedSnippet.value!.description,
      folderId: selectedSnippet.value!.folder?.id || null,
      isDeleted: selectedSnippet.value!.isDeleted,
      isFavorites: selectedSnippet.value!.isFavorites,
    })
  },
})
</script>

<template>
  <div data-editor-header>
    <div
      class="_pb-2 border-border grid grid-cols-[1fr_auto] items-center border-b px-2"
    >
      <div class="min-w-0 truncate">
        <UiInput
          v-model="name"
          variant="ghost"
          class="w-full px-0"
        />
      </div>
      <div class="ml-2">
        <UiButton variant="icon">
          <Plus class="h-4 w-4" />
        </UiButton>
      </div>
    </div>
    <div
      v-if="selectedSnippet?.contents && selectedSnippet.contents.length > 1"
      class="border-border flex gap-1 border-b"
    >
      <EditorTab
        v-for="(i, index) in selectedSnippet?.contents"
        :key="i.id"
        class="flex-1"
        :name="i.label"
        :class="{
          'bg-list-selection text-list-selection-fg':
            selectedSnippetContentIndex === index,
        }"
        @click="selectedSnippetContentIndex = index"
      />
    </div>
    <EditorDescription />
  </div>
</template>
