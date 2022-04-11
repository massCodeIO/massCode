<template>
  <div
    ref="listRef"
    class="snippet-list"
  >
    <div class="header">
      <SnippetListHeader />
    </div>
    <div
      ref="listRef"
      class="body"
    >
      <PerfectScrollbar>
        <SnippetListItem
          v-for="(i, index) in snippetStore.snippets"
          :id="i.id"
          :key="i.id"
          :data-id="i.id"
          :index="index"
          :folder="i.folder?.name"
          :date="i.updatedAt"
          :name="i.name"
        />
      </PerfectScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { emitter } from '@/composable'
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import { ref, watch } from 'vue'

const snippetStore = useSnippetStore()
const appStore = useAppStore()

const listRef = ref<HTMLElement>()

const setScrollPosition = (offset: number) => {
  const ps = listRef.value?.querySelector<HTMLElement>('.ps')
  if (ps) ps.scrollTop = offset
}

watch(
  () => appStore.isInit,
  () => {
    const el = document.querySelector<HTMLElement>(
      `[data-id='${snippetStore.selectedId!}']`
    )
    if (el?.offsetTop) setScrollPosition(el.offsetTop)
  }
)

emitter.on('folder:click', () => {
  setScrollPosition(0)
})
</script>

<style lang="scss" scoped>
.snippet-list {
  border-right: 1px solid var(--color-border);
  display: grid;
  grid-template-rows: 50px 1fr 10px;
}
.header {
  padding-top: var(--title-bar-height);
  display: flex;
  border-bottom: 1px solid var(--color-border);
}
.body {
  padding: var(--spacing-xs) 0;
  :deep(.ps) {
    height: calc(100vh - 60px);
    padding-top: 2px;
  }
}
</style>
