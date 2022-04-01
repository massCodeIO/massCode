<template>
  <div
    ref="itemRef"
    class="item"
    :class="{
      'is-selected': isSelected,
      'is-focused': isFocused,
      'is-system': system
    }"
    @click="isFocused = true"
  >
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
import { ref } from 'vue'
import Folder from '~icons/unicons/folder'
import AngleRight from '~icons/unicons/angle-right'
import { onClickOutside } from '@vueuse/core'

interface Props {
  icon?: FunctionalComponent
  system?: boolean
  nested?: boolean
  open?: boolean
  isSelected?: boolean
}

withDefaults(defineProps<Props>(), {
  system: false,
  nested: false,
  open: false
})

const isFocused = ref(false)
const itemRef = ref()

onClickOutside(itemRef, () => {
  isFocused.value = false
})
</script>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  padding: 4px 0;
  position: relative;
  width: 100%;
  z-index: 2;
  user-select: none;
  &.is-system {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }
  &.is-focused,
  &.is-selected,
  &.is-highlighted {
    &::before {
      content: '';
      position: absolute;
      top: 0px;
      left: 0px;
      right: 0px;
      bottom: 0px;
      border-radius: 5px;
      z-index: -1;
    }
  }

  &.is-selected {
    &::before {
      background-color: var(--color-sidebar-item-selected);
    }
  }
  &.is-focused {
    &::before {
      background-color: var(--color-primary);
    }
    color: #fff;
    :deep(svg) {
      fill: #fff;
    }
  }
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
