<template>
  <div class="list">
    <div class="header">
      <SnippetListActionBar />
    </div>
    <div class="body">
      <SnippetListItem
        v-for="i in snippetStore.snippets"
        :key="i.id"
        :folder="i.folder.name"
        :date="i.updatedAt"
        :name="i.name"
        :is-selected="i.id === snippetStore.selectedId"
        @click="onClickSnippet(i.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'

const snippetStore = useSnippetStore()

const onClickSnippet = (id: string) => {
  snippetStore.fragment = 0
  snippetStore.getSnippetsById(id)
}
</script>

<style lang="scss" scoped>
.list {
  border-right: 1px solid var(--color-border);
  display: grid;
  grid-template-rows: 50px 1fr;
}
.header {
  margin-top: 12px;
  display: flex;
}
.body {
  overflow-y: scroll;
  padding: var(--spacing-xs) 0;
  height: calc(100vh - 50px);
}
</style>
