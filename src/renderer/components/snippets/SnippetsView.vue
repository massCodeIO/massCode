<template>
  <div
    class="snippets-view"
    :class="{
      'is-one-row': isShowPlaceholder
    }"
  >
    <template v-if="snippetStore.selected">
      <SnippetHeader />
      <TheEditor
        v-model="snippet"
        v-model:lang="lang"
        :snippet-id="snippetStore.selectedId!"
        :fragment-index="snippetStore.fragment"
        :is-search-mode="snippetStore.searchQuery?.length > 0"
        :fragments="snippetStore.isFragmentsShow"
      />
    </template>
    <div
      v-else-if="isShowPlaceholder"
      class="placeholder"
    >
      <span v-if="snippetStore.selectedMultiple.length">
        {{ snippetStore.selectedMultiple.length }} Snippets Selected
      </span>
      <span v-else> No Snippet Selected</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed } from 'vue'

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
  }
})

const isShowPlaceholder = computed(() => {
  return (
    snippetStore.selectedMultiple.length || snippetStore.snippets.length === 0
  )
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
