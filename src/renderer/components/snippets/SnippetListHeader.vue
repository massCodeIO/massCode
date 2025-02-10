<template>
  <div class="action">
    <UniconsSearch />
    <input
      ref="inputRef"
      v-model="query"
      :placeholder="`${i18n.t('search')}...`"
    >
    <AppActionButton
      v-if="!query"
      v-tooltip="i18n.t('newSnippet')"
      class="item"
      @click="onAddNewSnippet"
    >
      <UniconsPlus />
    </AppActionButton>
    <AppActionButton
      v-else
      class="item"
      @click="onReset"
    >
      <UniconsTimes />
    </AppActionButton>
  </div>
</template>

<script setup lang="ts">
import { emitter, onAddNewSnippet } from '@/composable'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'
import { i18n } from '@/electron'
import { track } from '@/services/analytics'

const snippetStore = useSnippetStore()

const inputRef = ref<HTMLInputElement>()

const query = computed({
  get: () => snippetStore.searchQuery,
  set: useDebounceFn(async v => {
    snippetStore.searchQuery = v
    await snippetStore.setSnippetsByAlias('all')
    snippetStore.search(v!)
    track('snippets/search')
  }, 300)
})

const onReset = () => {
  snippetStore.searchQuery = undefined
  snippetStore.searchQueryEscaped = undefined
  snippetStore.setSnippetsByAlias('all')
}

emitter.on('search:focus', () => {
  inputRef.value?.focus()
})

onUnmounted(() => {
  emitter.off('search:focus')
})
</script>

<style lang="scss" scoped>
.action {
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-sm);
  position: relative;
  top: var(--title-bar-height-offset);
  width: 100%;
  input {
    outline: none;
    border: none;
    width: 100%;
    padding: 0 var(--spacing-xs);
    height: 24px;
    background-color: var(--color-snippet-list);
    color: var(--color-text);
  }
  :deep(svg) {
    flex-shrink: 0;
    fill: var(--color-button-action);
  }
  .item {
    position: relative;
    right: -8px;
  }
}
</style>
