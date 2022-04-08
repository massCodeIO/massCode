<template>
  <div class="action">
    <UniconsSearch />
    <input
      v-model="query"
      placeholder="Search..."
    >
    <AppActionButton
      v-if="!query"
      class="item"
      @click="onAddNewSnippet"
    >
      <UniconsPlus />
    </AppActionButton>
    <AppActionButton
      v-else
      class="item"
      @click="onReset"
    >
      <UniconsTimes />
    </AppActionButton>
  </div>
</template>

<script setup lang="ts">
import { emitter } from '@/composable'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed } from 'vue'

const snippetStore = useSnippetStore()
const folderStore = useFolderStore()

const query = computed({
  get: () => snippetStore.searchQuery,
  set: useDebounceFn(v => {
    snippetStore.searchQuery = v
    snippetStore.setSnippetsByAlias('all')
    snippetStore.search(v!)
  }, 300)
})

const onAddNewSnippet = async () => {
  if (folderStore.selectedAlias !== undefined) return
  if (!folderStore.selectedId) return

  await snippetStore.addNewSnippet()
  await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  await snippetStore.getSnippets()

  emitter.emit('focus:snippet-name', true)
}

const onReset = () => {
  snippetStore.searchQuery = undefined
  snippetStore.setSnippetsByAlias('all')
}
</script>

<style lang="scss" scoped>
.action {
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-sm);
  position: relative;
  top: var(--title-bar-height-offset);
  input {
    outline: none;
    border: none;
    width: 100%;
    padding: 0 var(--spacing-xs);
    height: 24px;
  }
  :deep(svg) {
    flex-shrink: 0;
  }
  .item {
    position: relative;
    right: -8px;
  }
}
</style>
