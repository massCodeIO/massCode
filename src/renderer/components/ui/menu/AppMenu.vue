<template>
  <div class="menu">
    <div class="names">
      <template v-if="groups.length">
        <template
          v-for="g in groups"
          :key="g.name"
        >
          <div class="group">
            {{ g.label }}
          </div>
          <div
            v-for="i in g.items"
            :key="i.value"
            class="name"
            :class="{ 'is-selected': modelValue === i.value }"
            @click="onClickItem(i)"
          >
            {{ i.name }}
          </div>
        </template>
      </template>
      <template v-else>
        <div
          v-for="i in items"
          :key="i.value"
          class="name"
          :class="{ 'is-selected': modelValue === i.value }"
          @click="onClickItem(i)"
        >
          {{ i.name }}
        </div>
      </template>
    </div>
    <div
      ref="bodyRef"
      class="body"
    >
      <PerfectScrollbar>
        <slot />
      </PerfectScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import type { MenuItem, GroupItem } from './types'
import { menuKey } from './keys'

interface Props {
  modelValue: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const emit = defineEmits<Emits>()

const props = defineProps<Props>()

const items = ref<MenuItem[]>([])
const groups = ref<GroupItem[]>([])

const bodyRef = ref<HTMLElement>()

const onClickItem = (item: MenuItem) => {
  emit('update:modelValue', item.value)
  const el = bodyRef.value?.querySelector('.ps')
  if (el) el.scrollTop = 0
}

provide(menuKey, {
  active: computed(() => props.modelValue),
  items,
  groups,
  onClickItem
})
</script>

<style lang="scss" scoped>
.menu {
  width: 100%;
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: var(--spacing-sm);
  .group {
    padding: var(--spacing-xs);
    font-weight: bold;
    &:not(:first-child) {
      padding-top: var(--spacing-sm);
    }
  }
  .name {
    padding: var(--spacing-xs);
    user-select: none;
    &.is-selected {
      border-radius: 5px;
      background-color: var(--color-menu-selected);
    }
  }
  .body {
    :deep(.ps) {
      height: calc(100vh - 80px);
    }
  }
}
</style>
