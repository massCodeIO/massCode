<template>
  <div class="snippets-view">
    <template v-if="snippetStore.snippet">
      <SnippetHeader />
      <TheEditor
        v-model="snippet"
        v-model:lang="lang"
        :fragments="snippetStore.isFragmentsShow"
      />
    </template>
    <div class="no-snippet">
      No Snippet Selected
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
</script>

<style lang="scss" scoped>
.snippets-view {
  overflow: hidden;
  padding-top: var(--title-bar-height);
}
.no-snippet {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
