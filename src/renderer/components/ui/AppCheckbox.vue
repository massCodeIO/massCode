<template>
  <div class="app-checkbox">
    <label>
      <input
        :id="'id-' + Math.random()"
        type="checkbox"
        :name="name"
        _value="localValue"
        @change="onChange"
      >
      <div class="inner">
        <UniconsCheck v-if="modelValue" />
      </div>
      <div
        v-if="label"
        class="label"
      >
        {{ label }}
      </div>
    </label>
  </div>
</template>

<script setup lang="ts">
interface Props {
  name: string
  label?: string
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const emit = defineEmits<Emits>()

const props = defineProps<Props>()

const onChange = () => {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style lang="scss" scoped>
.app-checkbox {
  input {
    display: none;
  }
  .inner {
    width: 16px;
    height: 16px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    display: flex;
    align-items: center;
    background-color: var(--color-checkbox);
    :deep(svg) {
      position: relative;
      fill: var(--color-text);
    }
  }
}
</style>
