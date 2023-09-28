<template>
  <textarea
    v-if="type === 'textarea'"
    v-model="localValue"
    class="textarea"
    v-bind="$attrs"
  />
  <input
    v-else
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
  type?: string
}

interface Emits {
  (e: 'update:modelValue', value: string | number): void
}

const emit = defineEmits<Emits>()

const props = withDefaults(defineProps<Props>(), {
  type: 'text'
})

const localValue = computed({
  get: () => props.modelValue,
  set: v => {
    emit('update:modelValue', v)
  }
})
</script>

<style lang="scss" scoped>
.input,
.textarea {
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

.input {
  width: 300px;
  height: 32px;
}

.textarea {
  padding: var(--spacing-xs);
  width: 400px;
  height: 150px;
  resize: vertical;
}
</style>
