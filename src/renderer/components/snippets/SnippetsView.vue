<template>
  <div
    class="snippets-view"
    :class="{
      'with-fragments': snippetStore.isFragmentsShow,
      'with-tags': snippetStore.isTagsShow
    }"
  >
    <template v-if="snippetStore.selected">
      <SnippetHeader />
      <TheEditor
        v-model="snippet"
        v-model:lang="lang"
        :fragments="snippetStore.isFragmentsShow"
      />
    </template>

    <div
      v-else-if="snippetStore.selectedMultiple?.length"
      class="no-snippet"
    >
      {{ snippetStore.selectedMultiple.length }} Snippets Selected
    </div>
    <div
      v-else
      class="no-snippet"
    >
      No Snippet Selected
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed } from 'vue'

const snippetStore = useSnippetStore()
const appStore = useAppStore()

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
  }
})

const viewHeight = computed(() => {
  let result = appStore.sizes.editor.titleHeight

  if (snippetStore.isFragmentsShow) {
    result += appStore.sizes.editor.fragmentsHeight
  }

  if (snippetStore.isTagsShow) {
    result += appStore.sizes.editor.tagsHeight
  }

  return result + 'px'
})
</script>

<style lang="scss" scoped>
.snippets-view {
  overflow: hidden;
  padding-top: var(--title-bar-height);
  display: grid;
  grid-template-rows: v-bind(viewHeight) 1fr;
}
.no-snippet {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  user-select: none;
}
</style>
