<template>
  <button class="button">
    <slot />
  </button>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.button {
  display: flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 4px;
  border: none;
  background-color: transparent;
  outline: none;
  color: var(--color-text);
  :deep(svg) {
    fill: var(--color-button-action);
  }
  &:hover {
    background-color: var(--color-button-action-hover);
  }
}
</style>
