<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const { isSearch, searchQuery, getSnippets, snippets } = useSnippets()
const { selectedSnippetId } = useApp()

async function search() {
  if (searchQuery.value) {
    isSearch.value = true
    await getSnippets({ search: searchQuery.value })
  }
  else {
    isSearch.value = false
    if (snippets.value)
      selectedSnippetId.value = snippets.value[0].id
  }
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
      <UiButton
        v-else
        variant="icon"
        size="icon"
        @click="clear"
      >
        <Plus class="h-4 w-4" />
      </UiButton>
    </div>
  </div>
</template>
