<template>
  <div
    ref="listRef"
    class="snippet-list"
  >
    <div class="header">
      <SnippetListHeader />
    </div>
    <div
      ref="bodyRef"
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
    <div
      ref="gutterRef"
      class="gutter-line"
    />
  </div>
</template>

<script setup lang="ts">
import { emitter, setScrollPosition } from '@/composable'
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import interact from 'interactjs'
import { store } from '@/electron'

const snippetStore = useSnippetStore()
const appStore = useAppStore()

const listRef = ref()
const bodyRef = ref<HTMLElement>()
const gutterRef = ref()

const scrollToSnippet = (id: string) => {
  const el = document.querySelector<HTMLElement>(`[data-id='${id}']`)
  if (el?.offsetTop) setScrollPosition(bodyRef.value!, el.offsetTop)
}

onMounted(() => {
  interact(listRef.value).resizable({
    allowFrom: gutterRef.value,
    onmove: e => {
      const { pageX } = e
      const minWidth = appStore.sizes.sidebar + 100
      const width = Math.floor(pageX - appStore.sizes.sidebar)

      if (pageX < minWidth) return
      appStore.sizes.snippetList = width
      store.app.set('snippetListWidth', width)
    }
  })
})

watch(
  () => appStore.isInit,
  () => scrollToSnippet(snippetStore.selectedId!)
)

emitter.on('folder:click', () => {
  setScrollPosition(bodyRef.value!, 0)
})

emitter.on('scroll-to:snippet', (id: string) => {
  scrollToSnippet(id)
})

onUnmounted(() => {
  emitter.off('folder:click')
  emitter.off('scroll-to:snippet')
})
</script>

<style lang="scss" scoped>
.snippet-list {
  position: relative;
  border-right: 1px solid var(--color-border);
  display: grid;
  grid-template-rows: 50px 1fr 10px;
  background-color: var(--color-snippet-list);
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
