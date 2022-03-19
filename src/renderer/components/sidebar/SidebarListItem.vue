<template>
  <div class="item">
    <span class="icon">
      <Component
        :is="AngleRight"
        v-if="nested"
        class="nested"
        :class="{ open: open }"
      />
      <Component :is="icon || Folder" />
    </span>
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { FunctionalComponent } from 'vue'
import Folder from '~icons/unicons/folder'
import AngleRight from '~icons/unicons/angle-right'

interface Props {
  icon?: FunctionalComponent
  system?: boolean
  nested?: boolean
  open?: boolean
}

withDefaults(defineProps<Props>(), {
  system: false,
  nested: false,
  open: false
})
</script>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  padding: 4px var(--spacing-sm);
  position: relative;
  .icon {
    margin-right: var(--spacing-xs);
    display: flex;
    align-items: center;
  }
  .nested {
    position: absolute;
    left: 0;
    &.open {
      transform: rotate(90deg);
    }
  }
}
</style>
