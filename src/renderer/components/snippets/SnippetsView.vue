<template>
  <div
    class="snippets-view"
    :class="{
      'is-one-row': isShowPlaceholder
    }"
  >
    <template v-if="snippetStore.selected">
      <SnippetHeader />
      <EditorCodemirror
        v-if="isEditorShow"
        v-model="snippet"
        v-model:lang="lang"
        :snippet-id="snippetStore.selectedId!"
        :fragment-index="snippetStore.fragment"
        :is-search-mode="isSearchMode"
        :fragments="snippetStore.isFragmentsShow"
      />
      <EditorPreview v-if="snippetStore.isCodePreview" />
      <TheMarkdown
        v-if="snippetStore.isMarkdownPreview"
        :value="snippetStore.currentContent!"
      />
      <MindMap
        v-if="snippetStore.isMindmapPreview"
        :value="snippetStore.currentContent!"
      />
      <TheScreenshot
        v-if="snippetStore.isScreenshotPreview"
        :snippet="snippet"
        :lang="lang"
        :name="snippetStore.selected?.name"
      />
    </template>
    <div
      v-else-if="isShowPlaceholder"
      class="placeholder"
    >
      <span v-if="snippetStore.selectedMultiple.length">
        {{
          i18n.t('snippet.selectedMultiple', {
            count: snippetStore.selectedMultiple.length
          })
        }}
      </span>
      <span v-else>{{ i18n.t('snippet.noSelected') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed } from 'vue'
import { i18n } from '@/electron'
import { track } from '@/services/analytics'

const snippetStore = useSnippetStore()

const snippet = computed({
  get: () => snippetStore.currentContent || '',
  set: useDebounceFn(v => {
    if (!v) return
    if (snippetStore.currentContent !== v) {
      snippetStore.patchCurrentSnippetContentByKey('value', v)
    }
  }, 300)
})

const lang = computed({
  get: () => snippetStore.currentLanguage || 'plain_text',
  set: v => {
    snippetStore.patchCurrentSnippetContentByKey('language', v)
    track('snippets/set-language', v)
  }
})

const isEditorShow = computed(() => {
  return (
    !snippetStore.isMarkdownPreview &&
    !snippetStore.isMindmapPreview &&
    !snippetStore.isScreenshotPreview
  )
})

const isShowPlaceholder = computed(() => {
  return (
    snippetStore.selectedMultiple.length ||
    !snippetStore.selected ||
    snippetStore.snippets.length === 0
  )
})

const isSearchMode = computed(() => {
  return snippetStore.searchQuery ? snippetStore.searchQuery.length > 0 : false
})
</script>

<style lang="scss" scoped>
.snippets-view {
  overflow: hidden;
  padding-top: var(--title-bar-height);
  display: flex;
  flex-flow: column;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  user-select: none;
}
</style>
