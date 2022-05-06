<template>
  <div
    class="description"
    :class="{ 'no-border-bottom': snippetStore.isFragmentsShow }"
    @click="onClick"
  >
    <PerfectScrollbar>
      <div
        ref="inputRef"
        class="input"
        contenteditable="true"
        spellcheck="false"
        placeholder="Add description"
        @blur="onBlur"
      >
        {{ desc }}
      </div>
    </PerfectScrollbar>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'

import { computed, nextTick, ref, watch } from 'vue'

const snippetStore = useSnippetStore()
const appStore = useAppStore()

const desc = computed(() => snippetStore.selected?.description)

const inputRef = ref<HTMLElement>()
const descHeight = appStore.sizes.editor.descriptionHeight + 'px'

const onBlur = (e: Event) => {
  snippetStore.patchSnippetsById(snippetStore.selectedId!, {
    description: (e.target as HTMLElement).innerText.trimEnd() || null
  })
}

const onClick = () => {
  inputRef.value?.focus()
}

watch(
  () => snippetStore.isDescriptionShow,
  v => {
    if (v && snippetStore.selected?.description?.length === 0) {
      nextTick(() => inputRef.value?.focus())
    }
  }
)
</script>

<style lang="scss" scoped>
.description {
  padding: 0 var(--spacing-xs);
  font-size: 12px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  :empty::before {
    content: attr(placeholder);
    position: absolute;
    color: var(--color-text-3);
    background-color: transparent;
  }
  &.no-border-bottom {
    border-bottom: none;
  }
  .input {
    width: 100%;
    border: 0;
    outline: 0;
    line-height: 14px;
    white-space: pre-wrap;
  }
  :deep(.ps) {
    height: v-bind(descHeight);
  }
}
</style>
