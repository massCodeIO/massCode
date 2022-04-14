<template>
  <div class="app-select">
    <select
      v-model="localValue"
      class="inner"
      v-bind="$attrs"
    >
      <option
        v-for="i in options"
        :key="i.value"
        :value="i.value"
      >
        {{ i.label }}
      </option>
    </select>
    <UniconsAngleDown />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  options: { label: string; value: string }[]
  modelValue: any
}

interface Emits {
  (e: 'update:modelValue', value: any): void
}

const emit = defineEmits<Emits>()

const props = defineProps<Props>()

const localValue = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})
</script>

<style lang="scss" scoped>
.app-select {
  position: relative;
  .inner {
    height: 32px;
    outline: none;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    padding: 0 var(--spacing-xs);
    -webkit-appearance: none;
    width: 300px;
    background-color: var(--color-select);
    color: var(--color-text);
  }
  :deep(svg) {
    position: absolute;
    right: 2px;
    top: 50%;
    transform: translateY(-50%);
    fill: var(--color-text);
  }
}
</style>
