<template>
  <button
    class="button"
    :class="{ 'is-active': active }"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  active?: boolean
}

defineProps<Props>()
</script>

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
  margin-right: 1px;
  &:last-child {
    margin-right: 0;
  }
  :deep(svg) {
    fill: var(--color-button-action);
  }
  &:hover {
    background-color: var(--color-button-action-hover);
    &.is-active {
      background-color: var(--color-button-action-hover);
    }
  }
  &.is-active {
    :deep(svg) {
      fill: var(--color-primary);
    }
  }
}
</style>
