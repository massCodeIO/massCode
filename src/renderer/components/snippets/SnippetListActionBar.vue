<template>
  <div class="action">
    <UniconsSearch />
    <input placeholder="Search...">
    <UniconsPlus />
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.action {
  display: flex;
  align-items: center;
  padding: var(--spacing-xs);
  input {
    outline: none;
    border: none;
    width: 100%;
    padding: 0 var(--spacing-xs);
  }
  :deep(svg) {
    flex-shrink: 0;
  }
}
</style>
