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
import { onAddNewSnippet } from '@/composable'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed } from 'vue'
import { track } from '@/electron'

const snippetStore = useSnippetStore()

const query = computed({
  get: () => snippetStore.searchQuery,
  set: useDebounceFn(v => {
    snippetStore.searchQuery = v
    snippetStore.setSnippetsByAlias('all')
    snippetStore.search(v!)
    track('snippets/search')
  }, 300)
})

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
  width: 100%;
  input {
    outline: none;
    border: none;
    width: 100%;
    padding: 0 var(--spacing-xs);
    height: 24px;
    background-color: var(--color-snippet-list);
  }
  :deep(svg) {
    flex-shrink: 0;
    fill: var(--color-text);
  }
  .item {
    position: relative;
    right: -8px;
  }
}
</style>
