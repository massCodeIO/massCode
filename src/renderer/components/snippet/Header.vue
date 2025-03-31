<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const {
  isSearch,
  searchQuery,
  getSnippets,
  selectSnippet,
  selectFirstSnippet,
  createSnippet,
} = useSnippets()
const {
  selectedSnippetContentIndex,
  selectedSnippetIdBeforeSearch,
  isFocusedSnippetName,
} = useApp()

async function search() {
  if (searchQuery.value) {
    isSearch.value = true
    selectedSnippetContentIndex.value = 0

    await getSnippets({ search: searchQuery.value })
    selectFirstSnippet()
  }
  else {
    isSearch.value = false
    if (selectedSnippetIdBeforeSearch.value) {
      selectSnippet(selectedSnippetIdBeforeSearch.value)
    }
  }
}

async function onAddSnippet() {
  await createSnippet()
  selectFirstSnippet()
  isFocusedSnippetName.value = true
}

function clear() {
  searchQuery.value = ''
}

watch(searchQuery, () => {
  search()
})
</script>

<template>
  <div class="border-border mt-[var(--title-bar-height)] mb-2 border-b">
    <div class="flex items-center">
      <Search class="text-text-muted ml-1 h-4 w-4" />
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('search')"
          variant="ghost"
        />
      </div>
      <UiButton
        v-if="searchQuery"
        variant="icon"
        size="icon"
        @click="clear"
      >
        <X class="h-4 w-4" />
      </UiButton>
      <UiActionButton
        v-if="!isSearch"
        :tooltip="i18n.t('newSnippet')"
        @click="onAddSnippet"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
