<template>
  <input
    v-model="localValue"
    class="input"
    type="text"
    v-bind="$attrs"
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string | number
}

interface Emits {
  (e: 'update:modelValue', value: string | number): void
}

const emit = defineEmits<Emits>()

const props = defineProps<Props>()

const localValue = computed({
  get: () => props.modelValue,
  set: v => {
    emit('update:modelValue', v)
  }
})
</script>

<style lang="scss" scoped>
.input {
  width: 300px;
  height: 32px;
  outline: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0 var(--spacing-xs);
  background-color: var(--color-input);
  color: var(--color-text);
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
}
</style>
