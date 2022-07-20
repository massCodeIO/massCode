<template>
  <div
    ref="previewRef"
    class="editor-preview"
  >
    <div class="tools">
      <div class="left">
        <AppCheckbox
          v-model="appStore.codePreview.darkMode"
          name="Dark mode"
          label="Dark mode"
        />
      </div>
      <div class="right">
        <div
          class="link"
          @click="onClickSnippetShowcase"
        >
          Snippets Showcase
        </div>
        <AppActionButton @click="onSaveToHtml">
          <UniconsFileDownload />
        </AppActionButton>
      </div>
    </div>
    <div class="body">
      <iframe
        :srcDoc="srcDoc"
        frameborder="0"
        height="100%"
        width="100%"
      />
    </div>
    <div
      ref="gutterRef"
      class="gutter-line-horizontal"
    />
  </div>
</template>

<script setup lang="ts">
import { useSnippetStore } from '@/store/snippets'
import { computed, ref, onMounted, watch } from 'vue'
import interact from 'interactjs'
import { useAppStore } from '@/store/app'
import { ipc, track } from '@/electron'

const snippetStore = useSnippetStore()
const appStore = useAppStore()
const srcDoc = ref()
const height = computed(() => appStore.sizes.codePreviewHeight + 'px')

const previewRef = ref()
const gutterRef = ref()

snippetStore.$subscribe(() => {
  setSrcDoc()
})

watch(
  () => appStore.codePreview.darkMode,
  () => {
    setSrcDoc()
  }
)

const setSrcDoc = () => {
  const html = snippetStore.selected?.content.find(
    i => i.language === 'html'
  )?.value
  const css = snippetStore.selected?.content.find(
    i => i.language === 'css'
  )?.value

  const htmlDefault =
    '<div>Add fragments with HTML & CSS languages to view result.</div>'
  const bg = appStore.codePreview.darkMode ? 'background: #263238;' : ''
  const cssDefault = `
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      ${bg}
    }
  `

  srcDoc.value = `<html>
    <body>${html || htmlDefault}<body>
    <style>${cssDefault + css}<style>
  </html>
  `
}
setSrcDoc()

const onSaveToHtml = () => {
  const a = document.createElement('a')

  a.href = `data:text/plain;charset=utf-8, ${encodeURIComponent(srcDoc.value)}`
  console.log(a)
  a.download = `${snippetStore.selected?.name}.html`
  a.click()
}

const onClickSnippetShowcase = () => {
  ipc.invoke('main:open-url', 'https://masscode.io/snippets')
  track('app/open-url', 'https://masscode.io/snippets')
}

onMounted(() => {
  interact(previewRef.value).resizable({
    edges: { top: true },
    onmove: e => {
      const { pageY } = e
      appStore.sizes.codePreviewHeight = Math.floor(window.innerHeight - pageY)
    }
  })
})
</script>

<style lang="scss" scoped>
.editor-preview {
  position: relative;
  .body {
    height: calc(v-bind(height) - 34px);
  }
  .tools {
    display: flex;
    height: 34px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px var(--spacing-xs);
    border-bottom: 1px solid var(--color-border);
    .right {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }
  }
  iframe {
    background-color: #fff;
  }
}
</style>
