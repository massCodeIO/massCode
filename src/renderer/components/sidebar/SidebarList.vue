<template>
  <div
    class="sidebar-list"
    :class="{
      'is-scrollable': isScrollable || modelValue === 'tags',
      'is-tags': modelValue === 'tags'
    }"
  >
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
      ref="bodyRef"
      class="body"
      :class="{ 'is-system': isSystem }"
    >
      <PerfectScrollbar v-if="isScrollable || modelValue === 'tags'">
        <div class="inner">
          <slot />
        </div>
      </PerfectScrollbar>
      <div
        v-else
        class="inner"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import type { Tab, Tabs } from '@shared/types/renderer/sidebar'
import { emitter, setScrollPosition } from '@/composable'

interface Props {
  title?: string
  tabs?: Tabs[]
  modelValue?: Tab
  isSystem?: boolean
  isScrollable?: boolean
  type?: 'folders' | 'tags'
}

interface Emits {
  (e: 'update:modelValue', value: Tab): void
}

const emit = defineEmits<Emits>()

const props = withDefaults(defineProps<Props>(), {
  isSystem: false
})

const bodyRef = ref<HTMLElement>()

const activeTab = computed({
  get: () => props.modelValue,
  set: v => {
    emit('update:modelValue', v!)
  }
})

const onClickTab = (tab: Tab) => {
  activeTab.value = tab
}

emitter.on('scroll-to:folder', id => {
  nextTick(() => {
    const el = document.querySelector<HTMLElement>(`[data-id='${id}']`)
    if (el) {
      setScrollPosition(bodyRef.value!, el.getBoundingClientRect().top + 210)
    }
  })
})

onUnmounted(() => {
  emitter.off('scroll-to:folder')
})
</script>

<style lang="scss" scoped>
.sidebar-list {
  margin-bottom: var(--spacing-xs);
  .body {
    .inner {
      padding: 0 var(--spacing-xs);
    }
  }
  // overflow: hidden;
  &.is-scrollable {
    :deep(.ps) {
      height: calc(100vh - 190px);
    }
    &.is-tags {
      :deep(.ps) {
        height: calc(100vh - 50px);
      }
    }
  }
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
  }
  &__title {
    h6 {
      color: var(--color-text);
    }
  }
  &__title,
  &__action {
    display: inline-block;
    padding: 0 var(--spacing-xs);
  }
  .tab-header {
    color: var(--color-text-3);
    padding: var(--spacing-xs) 0;
    -webkit-user-select: none;
    &.active {
      color: var(--color-text);
    }
    &:after {
      content: '/';
      margin: 0 5px;
      color: var(--color-text-3);
    }
    &:last-child {
      &:after {
        display: none;
      }
    }
  }
}
</style>
