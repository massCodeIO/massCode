<template>
  <div class="header">
    <div class="top">
      <div class="name">
        {{ snippetStore.snippet?.name }}
      </div>
      <div class="action">
        <AppActionButton>
          <UniconsArrow />
        </AppActionButton>
        <AppActionButton>
          <UniconsPlus />
        </AppActionButton>
      </div>
    </div>
    <div class="bottom">
      <SnippetFragments v-if="snippetStore.isFragmentsShow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'

const snippetStore = useSnippetStore()
</script>

<style lang="scss" scoped>
.header {
  .top {
    padding: 0 var(--spacing-xs);
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: var(--snippets-view-header-top-height);
  }
  .name {
    font-size: 16px;
  }
  .action {
    display: flex;
  }
}
</style>
