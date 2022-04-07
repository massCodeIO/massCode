<template>
  <div class="input-tags">
    <VueTagsInput
      v-model="tag"
      :autocomplete-items="tags"
      :tags="localValue"
      @tags-changed="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import { VueTagsInput } from '@sipec/vue3-tags-input'
import { useTagStore } from '@/store/tags'
import { computed, ref } from 'vue'

interface Props {
  modelValue: string[]
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void
}

const emit = defineEmits<Emits>()

const props = defineProps<Props>()

const tagStore = useTagStore()

const localValue = computed({
  get: () => props.modelValue.map(i => ({ text: i })),
  set: v => {
    emit(
      'update:modelValue',
      v.map(i => i.text)
    )
  }
})

const tag = ref('')

const tags = computed(() => {
  return tagStore.tags
    .map(i => ({ text: i.name }))
    .filter(i => i.text.toLowerCase().indexOf(tag.value.toLowerCase()) !== -1)
})

const onChange = (v: string[]) => {
  emit('update:modelValue', v)
}
</script>

<style lang="scss" scoped>
.input-tags {
  :deep(.vue-tags-input) {
    max-width: unset;
  }
  :deep(.ti-input) {
    padding: 0;
    border: none;
  }
  :deep(.ti-tags) {
    gap: 4px;
    .ti-new-tag-input-wrapper {
      margin: 0;
      input {
        size: 11px;
      }
    }
  }
  :deep(.ti-autocomplete) {
    margin-top: 2px;
    border: 1px solid var(--color-border);
    overflow-y: scroll;
    .ti-selected-item {
      background-color: var(--color-primary);
    }
  }
  :deep(.ti-tag) {
    background-color: var(--color-contrast-lower);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    margin: 0;
    padding: 0 4px;
    border-radius: 3px;
    font-size: 11px;
    &.ti-deletion-mark {
      background-color: var(--color-contrast-low);
    }
    .ti-icon-close {
      position: relative;
      top: 1px;
    }
  }
}
</style>
