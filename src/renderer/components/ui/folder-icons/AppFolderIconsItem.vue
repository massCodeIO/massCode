<template>
  <div
    class="item"
    :data-name="name"
    v-html="iconsSet[name]"
  />
</template>

<script setup lang="ts">
import { iconsSet } from './icons'
interface Props {
  name: string
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  &:hover {
    background-color: var(--color-snippet-selected);
  }
  :deep(svg) {
    width: 24px;
    height: 24px;
  }
  &.folder {
    :deep(svg) {
      width: 1.2em;
      height: 1.2em;
    }
  }
}
</style>
