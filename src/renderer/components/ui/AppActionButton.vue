<template>
  <div class="button">
    <slot />
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.button {
  display: flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 4px;
  svg {
    fill: var(--color-contrast-medium);
  }
  &:hover {
    background-color: var(--color-contrast-lower);
  }
}
</style>
