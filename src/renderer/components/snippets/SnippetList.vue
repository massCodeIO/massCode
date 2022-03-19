<template>
  <div class="list">
    <div class="header">
      <SnippetListActionBar />
    </div>
    <div class="body">
      <SnippetListItem
        v-for="i in 30"
        :key="i"
      />
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.list {
  border-right: 1px solid var(--color-border);
  display: grid;
  grid-template-rows: 50px 1fr;
}
.header {
  display: flex;
}
.body {
  overflow-y: scroll;
  height: calc(100vh - 50px);
}
</style>
