<template>
  <div class="fragments">
    <div
      v-for="(i, index) in snippetStore.fragmentLabels"
      :key="index"
      class="item"
      :class="{ 'is-active': index == snippetStore.fragment }"
      @click="onClickFragment(index)"
    >
      <SnippetsFragmentsInput :name="i" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'

const snippetStore = useSnippetStore()

const onClickFragment = (index: number) => {
  snippetStore.fragment = index
}
</script>

<style lang="scss" scoped>
.fragments {
  display: flex;
  align-items: center;
  height: var(--snippet-header-fragment-height);
  overflow-y: auto;
  .item {
    padding: 0 var(--spacing-xs);
    display: flex;
    align-items: center;
    height: var(--snippet-header-fragment-height);
    width: 100%;
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    min-width: 100px;
    &.is-active {
      background-color: var(--color-contrast-lower);
    }
  }
}
</style>
