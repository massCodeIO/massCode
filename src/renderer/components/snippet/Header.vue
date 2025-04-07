<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const {
  isSearch,
  searchQuery,
  selectFirstSnippet,
  createSnippet,
  clearSearch,
  search,
} = useSnippets()
const { isFocusedSnippetName } = useApp()

async function onAddSnippet() {
  await createSnippet()
  selectFirstSnippet()
  isFocusedSnippetName.value = true
}

watch(searchQuery, (v) => {
  if (v) {
    search()
  }
  else {
    clearSearch(true)
  }
})
</script>

<template>
  <div class="border-border mt-[var(--title-bar-height)] mb-2 border-b">
    <div class="flex items-center">
      <Search class="text-text-muted ml-1 h-4 w-4" />
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('placeholder.search')"
          variant="ghost"
        />
      </div>
      <UiButton
        v-if="searchQuery"
        variant="icon"
        size="icon"
        @click="clearSearch(true)"
      >
        <X class="h-4 w-4" />
      </UiButton>
      <UiActionButton
        v-if="!isSearch"
        :tooltip="i18n.t('action.new.snippet')"
        @click="onAddSnippet"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
