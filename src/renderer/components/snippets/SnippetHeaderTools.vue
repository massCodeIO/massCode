<template>
  <div class="snippet-tools">
    <slot />
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.snippet-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px var(--spacing-xs);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
</style>
