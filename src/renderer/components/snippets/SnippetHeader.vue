<template>
  <div class="header">
    <div class="top">
      <div class="name">
        <input
          ref="inputRef"
          v-model="name"
          type="text"
          :placeholder="i18n.t('snippet.emptyName')"
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
        <AppActionButton @click="onClickScreenshotPreview">
          <UniconsCamera v-if="!snippetStore.isScreenshotPreview" />
          <UniconsCameraSlash v-else />
        </AppActionButton>
        <AppActionButton @click="onCodePreview">
          <SvgArrowSlash v-if="snippetStore.isCodePreview" />
          <UniconsArrow v-else />
        </AppActionButton>
        <AppActionButton @click="onAddDescription">
          <UniconsText />
        </AppActionButton>
        <AppActionButton @click="onAddNewFragment">
          <UniconsPlus />
        </AppActionButton>
      </div>
    </div>
    <div class="bottom">
      <SnippetsDescription v-show="snippetStore.isDescriptionShow" />
      <SnippetFragments v-if="snippetStore.isFragmentsShow" />
      <SnippetsTags
        v-if="snippetStore.isTagsShow && !snippetStore.isScreenshotPreview"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  onAddNewFragment,
  onAddDescription,
  onCopySnippet,
  emitter
} from '@/composable'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/store/app'
import { track, i18n } from '@/electron'

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

const onClickScreenshotPreview = () => {
  snippetStore.isScreenshotPreview = !snippetStore.isScreenshotPreview
}
const onCodePreview = () => {
  snippetStore.isCodePreview = !snippetStore.isCodePreview
  track('snippets/code-preview')
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
