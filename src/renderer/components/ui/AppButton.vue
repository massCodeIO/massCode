<template>
  <button class="button">
    <slot />
  </button>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.button {
  height: 32px;
  border: 1px solid var(--color-border);
  background-color: var(--color-contrast-lower-alt);
  border-radius: 3px;
  transition: all 0.2s;
  &:hover {
    background-color: var(--color-contrast-low);
  }
}
</style>
