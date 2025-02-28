<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'

const { isSearch, searchQuery, getSnippets, snippets } = useSnippets()
const { selectedSnippetId } = useApp()

async function onSearch() {
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
</script>

<template>
  <div class="my-5">
    <input
      v-model="searchQuery"
      class="border border-border-snippet w-full p-1 rounded-md"
      placeholder="Search"
      type="text"
      @input="onSearch"
    >
  </div>
</template>
