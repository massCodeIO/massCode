<template>
  <div
    class="fragment"
    @dblclick="isEdit = true"
  >
    <div
      v-if="!isEdit"
      class="name"
      :value="name"
    >
      {{ name }}
    </div>
    <input
      v-else
      ref="inputRef"
      v-model="localName"
      class="is-edit"
      type="text"
    >
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useSnippetStore } from '@/store/snippets'
import { onClickOutside, useDebounceFn } from '@vueuse/core'

interface Props {
  name: string
}

const props = defineProps<Props>()

const snippetStore = useSnippetStore()

const isEdit = ref(false)

const inputRef = ref<HTMLInputElement>()

const localName = computed({
  get: () => props.name,
  set: useDebounceFn(v => {
    snippetStore.patchCurrentSnippetContentByKey('label', v)
  }, 300)
})

onClickOutside(inputRef, async () => {
  isEdit.value = false
  if (!props.name) {
    snippetStore.patchCurrentSnippetContentByKey('label', 'Untitled fragment')
  }
})

watch(isEdit, () => {
  nextTick(() => inputRef.value?.select())
})
</script>

<style lang="scss" scoped>
.fragment {
  width: 100%;
  text-overflow: ellipsis;

  input {
    background-color: transparent;
    width: 100%;
    border: 0;
    outline: none;
    min-width: 100px;
    &.is-edit {
      background-color: #fff;
    }
  }
}
.name {
  user-select: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
