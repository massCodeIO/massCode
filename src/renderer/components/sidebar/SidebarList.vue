<template>
  <div class="sidebar-list">
    <div class="sidebar-list__header">
      <div class="sidebar-list__title">
        <h6 v-if="!tabs">
          {{ title }}
        </h6>
        <h6>
          <span
            v-for="i in tabs"
            :key="i.value"
            class="tab-header"
            :class="{ active: modelValue === i.value }"
            @click="onClickTab(i.value)"
          >{{ i.label }}</span>
        </h6>
      </div>
      <div class="sidebar-list__action">
        <slot name="action" />
      </div>
    </div>
    <div
      class="body"
      :class="{ 'is-system': isSystem }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Tab, Tabs } from './types'

interface Props {
  title?: string
  tabs?: Tabs[]
  modelValue?: Tab
  isSystem?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: Tab): void
}

const emit = defineEmits<Emits>()

const props = withDefaults(defineProps<Props>(), {
  isSystem: false
})

const activeTab = computed({
  get: () => props.modelValue,
  set: v => {
    emit('update:modelValue', v!)
  }
})

const onClickTab = (tab: Tab) => {
  activeTab.value = tab
}
</script>

<style lang="scss" scoped>
.sidebar-list {
  margin-bottom: var(--spacing-xs);
  padding: 0 var(--spacing-xs);
  // height: 100%;
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
    svg {
      stroke: var(--color-contrast-medium);
      width: 16px;
      height: 16px;
    }
  }
  &__title {
    h6 {
      color: var(--color-contrast-medium);
    }
  }
  &__title,
  &__action {
    display: inline-block;
  }
  .tab-header {
    color: var(--color-contrast-low-alt);
    padding: var(--spacing-xs) 0;
    -webkit-user-select: none;
    &.active {
      color: var(--color-contrast-medium);
    }
    &:after {
      content: '/';
      margin: 0 5px;
      color: var(--color-contrast-low-alt);
    }
    &:last-child {
      &:after {
        display: none;
      }
    }
  }
}
</style>
