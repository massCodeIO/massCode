<template>
  <div
    class="snippet-tools"
    :class="{ 'no-border-top': snippetStore.isFragmentsShow }"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'

const snippetStore = useSnippetStore()
console.log(snippetStore.isFragmentsShow)
</script>

<style lang="scss" scoped>
.snippet-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px var(--spacing-xs);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  &.no-border-top {
    border-top: none;
  }
}
</style>
