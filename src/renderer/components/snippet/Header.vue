<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
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
  <div class="mt-5 mb-2">
    <div class="flex items-center">
      <Search class="w-4 h-4 text-text-muted ml-1" />
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          placeholder="Search"
          variant="ghost"
        />
      </div>
      <UiButton
        v-if="searchQuery"
        variant="icon"
        size="sm"
        @click="clear"
      >
        <X class="w-4 h-4 text-text-muted" />
      </UiButton>
      <UiButton
        v-else
        variant="icon"
        size="sm"
        @click="clear"
      >
        <Plus class="w-4 h-4 text-text-muted" />
      </UiButton>
    </div>
  </div>
</template>
