<script setup lang="ts">
import { useSnippets } from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { useDark } from '@vueuse/core'
import CodeMirror from 'codemirror'
import { Minus, Plus } from 'lucide-vue-next'
import { marked } from 'marked'
import mermaid from 'mermaid'
import sanitizeHtml from 'sanitize-html'
import { nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMarkdown } from './composables'
import 'codemirror/addon/runmode/runmode'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

const isDev = import.meta.env.DEV

const { selectedSnippetContent } = useSnippets()
const isDark = useDark()
const { scaleToShow, onZoom } = useMarkdown()

const route = useRoute()

const renderedContent = ref('')
const codeEditors = ref<CodeMirror.Editor[]>([])
const codeBlocksData = ref<{ id: string, value: string, language?: string }[]>(
  [],
)

const markdownRef = useTemplateRef('markdownRef')

const isShowHeaderTool = route.name !== 'markdown-presentation'

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid">${text}</div>`
      }

      const id = Math.random().toString(36).substring(2, 15)
      codeBlocksData.value.push({ id, value: text, language: lang })

      return `<div id="${id}" class="code-block"></div>`
    },
    link({ href, text }) {
      if (href.startsWith('masscode://')) {
        return `<a href="${href}" class="deep-link">${text}</a>`
      }
      else {
        return `<a href="${href}" class="external">${text}</a>`
      }
    },
  },
})

async function renderMarkdown() {
  if (selectedSnippetContent.value?.value) {
    const markdownHtml = await marked.parse(selectedSnippetContent.value.value)

    let sanitizedHtml = sanitizeHtml(markdownHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'del']),
      allowedAttributes: {
        '*': [
          'align',
          'alt',
          'height',
          'href',
          'name',
          'src',
          'target',
          'width',
          'class',
          'type',
          'checked',
          'disabled',
          'id',
          'data-*',
        ],
      },
      allowedSchemes: ['http', 'https', 'masscode'],
    })

    const re = /src="\.\//g
    const path = store.preferences.get('storagePath')

    sanitizedHtml = isDev
      ? sanitizedHtml.replace(re, `src="file://${path}/`)
      : sanitizedHtml.replace(re, `src="${path}/`)

    renderedContent.value = sanitizedHtml
  }
  else {
    renderedContent.value = ''
    codeEditors.value = []
    codeBlocksData.value = []
  }
}

function renderCodeBlockEditors() {
  codeEditors.value = []

  codeBlocksData.value.forEach((blockData) => {
    const container = document.getElementById(blockData.id)

    if (container) {
      const editor = CodeMirror(container as HTMLElement, {
        value: blockData.value,
        mode: blockData.language,
        theme: isDark.value ? 'oceanic-next' : 'neo',
        readOnly: true,
        lineNumbers: false,
        lineWrapping: true,
        scrollbarStyle: 'null',
      })
      codeEditors.value.push(editor)
    }
  })
}

function renderMermaidBlocks() {
  mermaid.initialize({
    startOnLoad: true,
    theme: isDark.value ? 'dark' : 'default',
  })

  mermaid.run()
}

function onLinkClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  if (target.tagName === 'A') {
    const href = target.getAttribute('href')

    if (href && target.classList.contains('external')) {
      ipc.invoke('system:open-external', href)
      event.preventDefault()
    }
  }
}

watch(selectedSnippetContent, async () => renderMarkdown(), {
  immediate: true,
})

watch(scaleToShow, () => renderMarkdown())

watch(renderedContent, () => {
  nextTick(() => {
    renderCodeBlockEditors()
    renderMermaidBlocks()

    markdownRef.value?.removeEventListener('click', onLinkClick)
    markdownRef.value?.addEventListener('click', onLinkClick)
  })
})

watch(isDark, (value) => {
  const theme = value ? 'oceanic-next' : 'neo'
  codeEditors.value.forEach((editor) => {
    editor.setOption('theme', theme)
  })
})
</script>

<template>
  <div
    data-editor-markdown
    class="grid grid-rows-[auto_1fr] overflow-scroll"
  >
    <EditorHeaderTool v-if="isShowHeaderTool">
      <div class="flex w-full justify-end gap-2 px-2">
        <UiActionButton
          :tooltip="i18n.t('button.zoomOut')"
          @click="onZoom('out')"
        >
          <Minus class="h-3 w-3" />
        </UiActionButton>
        <div class="tabular-nums select-none">
          {{ scaleToShow }}
        </div>
        <UiActionButton
          :tooltip="i18n.t('button.zoomIn')"
          @click="onZoom('in')"
        >
          <Plus class="h-3 w-3" />
        </UiActionButton>
      </div>
    </EditorHeaderTool>
    <PerfectScrollbar :options="{ minScrollbarLength: 20 }">
      <div
        ref="markdownRef"
        class="markdown-content"
      >
        <div v-html="renderedContent" />
      </div>
    </PerfectScrollbar>
  </div>
</template>

<style>
@reference '../../../styles.css';

.markdown-content {
  @apply overflow-auto p-4 font-sans text-[var(--color-text)];
  font-size: calc(1rem * var(--markdown-scale));
  line-height: 1.5;
}

.markdown-content h1 {
  @apply my-4 border-b border-[var(--color-border)] pb-2 font-semibold text-[var(--color-text)] first-of-type:mt-0;
  font-size: calc(2.25rem * var(--markdown-scale));
}

.markdown-content h2 {
  @apply my-5 border-b border-[var(--color-border)] pb-2 font-semibold text-[var(--color-text)] first-of-type:mt-0;
  font-size: calc(1.875rem * var(--markdown-scale));
}

.markdown-content h3 {
  @apply my-6 font-semibold text-[var(--color-text)];
  font-size: calc(1.5rem * var(--markdown-scale));
}

.markdown-content h4 {
  @apply my-7 font-semibold text-[var(--color-text)];
  font-size: calc(1.25rem * var(--markdown-scale));
}

.markdown-content p {
  @apply mb-4;
  font-size: calc(1rem * var(--markdown-scale));
}

.markdown-content a {
  @apply text-blue-600 no-underline dark:text-blue-400;
}

.markdown-content a:hover {
  @apply underline;
}

.markdown-content strong {
  @apply font-semibold;
}

.markdown-content em {
  @apply italic;
}

.markdown-content ul,
.markdown-content ol {
  @apply mb-4 ml-8;
  list-style-position: outside;
}

.markdown-content ul {
  list-style-type: disc;
}

.markdown-content ol {
  list-style-type: decimal;
}

.markdown-content ul ul,
.markdown-content ol ol,
.markdown-content ul ol,
.markdown-content ol ul {
  @apply mb-0 ml-6;
}

.markdown-content li {
  @apply mb-1;
}

.markdown-content blockquote {
  @apply mb-4 border-l-4 border-[var(--color-border)] pl-4 text-[var(--color-text-muted)];
}

.markdown-content code {
  @apply rounded bg-[rgba(27,31,35,0.05)] px-1 py-0.5 dark:bg-[rgba(255,255,255,0.1)];
  font-size: calc(0.875rem * var(--markdown-scale));
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.markdown-content pre {
  @apply mb-4 overflow-auto rounded bg-[var(--color-button)] p-4 leading-5 dark:bg-[var(--color-button)];
  font-size: calc(0.875rem * var(--markdown-scale));
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.markdown-content pre code {
  @apply m-0 border-0 bg-transparent p-0 text-base;
}

.markdown-content table {
  @apply mb-4 block border-collapse overflow-x-auto;
}

.markdown-content tr {
  @apply border-t border-[var(--color-border)];
}

.markdown-content td,
.markdown-content th {
  @apply border border-[var(--color-border)] p-2;
}

.markdown-content th {
  @apply bg-[var(--color-button)] font-semibold dark:bg-[var(--color-button)];
}

.markdown-content tr:nth-child(2n) {
  @apply bg-[var(--color-button)] dark:bg-[var(--color-button)];
}

.markdown-content img {
  @apply box-content max-w-full;
}

.markdown-content hr {
  @apply my-6 border-t border-[var(--color-border)] p-0;
}

.markdown-content .CodeMirror {
  @apply !bg-markdown-code overflow-auto rounded-md p-4;
  font-size: calc(0.875rem * var(--markdown-scale));
  line-height: calc(0.875rem * var(--markdown-scale) * 1.5);
}

.markdown-content .code-block > div {
  @apply overflow-hidden;
}
</style>
