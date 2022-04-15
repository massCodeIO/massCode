<template>
  <div class="header">
    <div class="top">
      <div class="name">
        <input
          ref="inputRef"
          v-model="name"
          type="text"
          placeholder="Type snippet name"
        >
      </div>
      <div class="action">
        <AppActionButton
          v-if="snippetStore.currentLanguage === 'markdown'"
          @click="onClickMarkdownPreview"
        >
          <UniconsEye v-if="!snippetStore.isMarkdownPreview" />
          <UniconsEyeSlash v-else />
        </AppActionButton>
        <AppActionButton @click="onCopySnippet">
          <UniconsArrow />
        </AppActionButton>
        <AppActionButton @click="onAddNewFragment">
          <UniconsPlus />
        </AppActionButton>
      </div>
    </div>
    <div class="bottom">
      <SnippetFragments v-if="snippetStore.isFragmentsShow" />
      <SnippetsTags v-if="snippetStore.isTagsShow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { emitter, onAddNewFragment, onCopySnippet } from '@/composable'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/store/app'

const snippetStore = useSnippetStore()
const appStore = useAppStore()

const inputRef = ref<HTMLInputElement>()

const headerHeight = appStore.sizes.editor.titleHeight + 'px'

const name = computed({
  get: () => snippetStore.selected?.name,
  set: useDebounceFn(
    v =>
      snippetStore.patchSnippetsById(snippetStore.selectedId!, { name: v }),
    300
  )
})

const onClickMarkdownPreview = () => {
  snippetStore.isMarkdownPreview = !snippetStore.isMarkdownPreview
}

emitter.on('snippet:focus-name', () => {
  inputRef.value?.select()
})

onUnmounted(() => {
  emitter.off('snippet:focus-name')
})
</script>

<style lang="scss" scoped>
.header {
  .top {
    padding: 0 var(--spacing-xs);
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: v-bind(headerHeight);
    position: relative;
    top: var(--title-bar-height-offset);
  }
  .name {
    font-size: 16px;
    width: 100%;
    input {
      border: 0;
      width: 100%;
      outline: none;
      line-height: 32px;
      text-overflow: ellipsis;
      background-color: var(--color-bg);
      color: var(--color-text);
    }
  }
  .action {
    display: flex;
  }
}
</style>
