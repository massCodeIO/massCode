<template>
  <div class="list">
    <div class="header">
      <SnippetListHeader />
    </div>
    <div class="body">
      <SnippetListItem
        v-for="(i, index) in snippetStore.snippets"
        :id="i.id"
        :key="i.id"
        :index="index"
        :folder="i.folder?.name"
        :date="i.updatedAt"
        :name="i.name"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'

const snippetStore = useSnippetStore()
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
