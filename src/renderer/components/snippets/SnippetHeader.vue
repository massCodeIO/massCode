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
        <AppActionButton>
          <UniconsArrow />
        </AppActionButton>
        <AppActionButton>
          <UniconsPlus @click="onAddNewFragment" />
        </AppActionButton>
      </div>
    </div>
    <div class="bottom">
      <SnippetFragments v-if="snippetStore.isFragmentsShow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { emitter } from '@/composable'
import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref } from 'vue'

const snippetStore = useSnippetStore()
const inputRef = ref<HTMLInputElement>()

const name = computed({
  get: () => snippetStore.selected?.name,
  set: useDebounceFn(
    v =>
      snippetStore.patchSnippetsById(snippetStore.selectedId!, { name: v }),
    300
  )
})

const onAddNewFragment = () => {
  snippetStore.addNewFragmentToSnippetsById(snippetStore.selectedId!)
  snippetStore.fragment = snippetStore.fragmentCount!
}

emitter.on('focus:snippet-name', () => {
  inputRef.value?.select()
})
</script>

<style lang="scss" scoped>
.header {
  .top {
    padding: 0 var(--spacing-xs);
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: var(--snippets-view-header-top-height);
  }
  .name {
    font-size: 16px;
    width: 100%;
    input {
      border: 0;
      width: 100%;
      outline: none;
      text-overflow: ellipsis;
    }
  }
  .action {
    display: flex;
  }
}
</style>
