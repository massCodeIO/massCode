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
          v-tooltip="i18n.t('menu:markdown.presentationMode')"
          tabindex="-1"
          @click="onClickPresentationMode"
        >
          <UniconsMeetingBoard />
        </AppActionButton>
        <AppActionButton
          v-if="snippetStore.currentLanguage === 'markdown'"
          v-tooltip="
            !snippetStore.isMarkdownPreview
              ? i18n.t('menu:editor.previewMarkdown')
              : i18n.t('hide') + ' ' + i18n.t('menu:editor.previewMarkdown')
          "
          tabindex="-1"
          @click="onClickMarkdownPreview"
        >
          <UniconsEye v-if="!snippetStore.isMarkdownPreview" />
          <UniconsEyeSlash v-else />
        </AppActionButton>
        <AppActionButton
          v-tooltip="
            !snippetStore.isScreenshotPreview
              ? i18n.t('menu:editor.previewScreenshot')
              : i18n.t('hide') + ' ' + i18n.t('menu:editor.previewScreenshot')
          "
          tabindex="-1"
          @click="onClickScreenshotPreview"
        >
          <UniconsCamera v-if="!snippetStore.isScreenshotPreview" />
          <UniconsCameraSlash v-else />
        </AppActionButton>
        <AppActionButton
          v-tooltip="
            !snippetStore.isCodePreview
              ? i18n.t('menu:editor.previewCode')
              : i18n.t('hide') + ' ' + i18n.t('menu:editor.previewCode')
          "
          tabindex="-1"
          @click="onCodePreview"
        >
          <SvgArrowSlash v-if="snippetStore.isCodePreview" />
          <UniconsArrow v-else />
        </AppActionButton>
        <AppActionButton
          v-tooltip="i18n.t('addDescription')"
          tabindex="-1"
          @click="onAddDescription"
        >
          <UniconsText />
        </AppActionButton>
        <AppActionButton
          v-tooltip="i18n.t('newFragment')"
          tabindex="-1"
          @click="onAddNewFragment"
        >
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
import { onAddNewFragment, onAddDescription, emitter } from '@/composable'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/store/app'
import { track, i18n } from '@/electron'
import { useRouter } from 'vue-router'

const snippetStore = useSnippetStore()
const appStore = useAppStore()
const router = useRouter()

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
  track('snippets/markdown-preview')
}

const onClickScreenshotPreview = () => {
  snippetStore.isScreenshotPreview = !snippetStore.isScreenshotPreview
}
const onCodePreview = () => {
  snippetStore.isCodePreview = !snippetStore.isCodePreview
  track('snippets/code-preview')
}

const onClickPresentationMode = () => {
  router.push('/presentation')
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
