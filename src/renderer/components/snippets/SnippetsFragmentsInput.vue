<template>
  <div
    class="fragment"
    @dblclick="isEdit = true"
    @contextmenu="onClickContext"
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
import { ipc } from '@/electron'
import type {
  ContextMenuPayload,
  ContextMenuResponse
} from '@shared/types/main'

interface Props {
  name: string
  index: number
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

const onClickContext = async () => {
  const { action } = await ipc.invoke<ContextMenuResponse, ContextMenuPayload>(
    'context-menu:snippet-fragment',
    {
      name: props.name,
      type: 'folder'
    }
  )

  if (action === 'rename') {
    isEdit.value = true
  }

  if (action === 'delete') {
    await snippetStore.deleteCurrentSnippetFragmentByIndex(props.index)
    snippetStore.fragment = snippetStore.fragmentCount! - 1
  }
}

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
