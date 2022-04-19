<template>
  <div class="menu">
    <div class="names">
      <div
        v-for="i in items"
        :key="i.value"
        class="name"
        :class="{ 'is-selected': modelValue === i.value }"
        @click="onClickItem(i)"
      >
        {{ i.name }}
      </div>
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

interface Props {
  modelValue: string
}

interface Item {
  name: string
  value: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const emit = defineEmits<Emits>()

const props = defineProps<Props>()

const items = ref<Item[]>([])
const value = computed(() => props.modelValue)
const bodyRef = ref<HTMLElement>()

const onClickItem = (item: Item) => {
  emit('update:modelValue', item.value)
  const el = bodyRef.value?.querySelector('.ps')
  if (el) el.scrollTop = 0
}

const update = (value: string) => {
  emit('update:modelValue', value)
}

provide('update', update)
provide('value', value)
provide('items', items.value)
</script>

<style lang="scss" scoped>
.menu {
  width: 100%;
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: var(--spacing-sm);
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
