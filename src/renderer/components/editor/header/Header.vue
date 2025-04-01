<script setup lang="ts">
import { useApp, useSnippets, useSnippetUpdate } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Type } from 'lucide-vue-next'

const { selectedSnippet, createSnippetContent } = useSnippets()
const { isFocusedSnippetName, state } = useApp()
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

async function onAddFragment() {
  const index = await createSnippetContent(selectedSnippet.value!.id)

  if (index) {
    state.snippetContentIndex = index
  }
}

function onClickTab(index: number) {
  state.snippetContentIndex = index
}
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
          :select="isFocusedSnippetName"
          @blur="isFocusedSnippetName = false"
        />
      </div>
      <div class="ml-2 flex">
        <UiActionButton
          :tooltip="i18n.t('addDescription')"
          @click="isShowDescription = !isShowDescription"
        >
          <Type class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('newFragment')"
          @click="onAddFragment"
        >
          <Plus class="h-4 w-4" />
        </UiActionButton>
      </div>
    </div>
    <div
      v-if="selectedSnippet?.contents && selectedSnippet.contents.length > 1"
      class="border-border grid auto-cols-fr grid-flow-col border-b"
    >
      <EditorTab
        v-for="(i, index) in selectedSnippet?.contents"
        :id="i.id"
        :key="i.id"
        :index="index"
        :name="i.label"
        :class="{
          'bg-list-selection text-list-selection-fg':
            state.snippetContentIndex === index,
        }"
        @click="onClickTab(index)"
      />
    </div>
    <EditorDescription v-model:show="isShowDescription" />
    <div class="pt-1">
      <EditorHeaderTags />
    </div>
  </div>
</template>
