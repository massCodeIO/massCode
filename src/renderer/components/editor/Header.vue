<script setup lang="ts">
import { useApp, useSnippets, useSnippetUpdate } from '@/composables'
import { Plus, Type } from 'lucide-vue-next'

const { selectedSnippet } = useSnippets()
const { selectedSnippetContentIndex } = useApp()
const { addToUpdateQueue } = useSnippetUpdate()

const isShowDescription = ref(false)

const name = computed({
  get() {
    return selectedSnippet?.value?.name
  },
  set(v: string) {
    addToUpdateQueue(selectedSnippet.value!.id, {
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
      class="border-border grid grid-cols-[1fr_auto] items-center border-b px-2"
    >
      <div class="min-w-0 truncate">
        <UiInput
          v-model="name"
          variant="ghost"
          class="w-full px-0"
        />
      </div>
      <div class="ml-2 flex">
        <UiButton
          variant="icon"
          size="icon"
          @click="isShowDescription = !isShowDescription"
        >
          <Type class="h-3 w-3" />
        </UiButton>
        <UiButton
          variant="icon"
          size="icon"
        >
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
    <EditorDescription v-model:show="isShowDescription" />
  </div>
</template>
