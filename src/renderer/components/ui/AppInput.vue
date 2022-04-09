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
  modelValue: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
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
  min-width: 300px;
  height: 32px;
  outline: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
}
</style>
