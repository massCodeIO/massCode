<template>
  <div
    ref="itemRef"
    class="item"
    :class="{
      'is-selected': !isFocused && isSelected,
      'is-focused': isFocused
    }"
    @click="isFocused = true"
  >
    <div class="header">
      <div class="name">
        <span>
          {{ name }}
        </span>
      </div>
    </div>
    <div class="footer">
      <div class="folder">
        {{ folder }}
      </div>
      <div class="date">
        {{ date }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'

interface Props {
  name: string
  folder: string
  date: number | string
  isSelected: boolean
}

defineProps<Props>()

const itemRef = ref()
const isFocused = ref(false)

onClickOutside(itemRef, () => {
  isFocused.value = false
})
</script>

<style lang="scss" scoped>
.item {
  padding: var(--spacing-xs) var(--spacing-sm);
  position: relative;
  z-index: 2;
  &::after {
    content: '';
    height: 1px;
    background-color: var(--color-border);
    position: absolute;
    width: calc(100% - calc(var(--spacing-sm) * 2));
    bottom: 1px;
  }
  &.is-focused,
  &.is-selected {
    &::before {
      content: '';
      position: absolute;
      top: -2px;
      left: 8px;
      right: 8px;
      bottom: 0px;
      border-radius: 5px;
      z-index: 1;
    }
  }
  &.is-focused {
    &::before {
      background-color: var(--color-primary);
    }
    .name,
    .footer {
      color: #fff;
    }
  }
  &.is-selected {
    &::before {
      background-color: var(--color-snippet-selected);
    }
    .name,
    .footer {
      color: var(--color-text);
    }
  }
}
.name {
  display: table;
  table-layout: fixed;
  width: 100%;
  overflow: hidden;
  position: relative;
  z-index: 1;
  span {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }
}
.footer {
  font-size: 11px;
  display: flex;
  position: relative;
  z-index: 1;
  justify-content: space-between;
  color: var(--color-contrast-medium);
  padding-top: var(--spacing-sm);
}
</style>
