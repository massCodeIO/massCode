<script setup lang="ts">
import { useMarkdown } from '@/components/editor/markdown/composables'
import { useNotes, useTheme } from '@/composables'
import { ipc, store } from '@/electron'
import CodeMirror from 'codemirror'
import { marked } from 'marked'
import mermaid from 'mermaid'
import sanitizeHtml from 'sanitize-html'
import 'codemirror/addon/runmode/runmode'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

const isDev = import.meta.env.DEV

const { selectedNote } = useNotes()
const { isDark, editorThemeName } = useTheme()
const { scaleToShow } = useMarkdown()

const renderedContent = ref('')
const codeEditors = ref<CodeMirror.Editor[]>([])
const codeBlocksData = ref<{ id: string, value: string, language?: string }[]>(
  [],
)

const markdownRef = useTemplateRef('markdownRef')

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
  const content = selectedNote.value?.content

  if (content) {
    const markdownHtml = await marked.parse(content)

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
        theme: editorThemeName.value,
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

watch(
  () => selectedNote.value?.id,
  async () => renderMarkdown(),
  { immediate: true },
)

watch(scaleToShow, () => renderMarkdown())

watch(renderedContent, () => {
  nextTick(() => {
    renderCodeBlockEditors()
    renderMermaidBlocks()

    markdownRef.value?.removeEventListener('click', onLinkClick)
    markdownRef.value?.addEventListener('click', onLinkClick)
  })
})

watch(editorThemeName, (theme) => {
  codeEditors.value.forEach((editor) => {
    editor.setOption('theme', theme)
  })
})

watch(isDark, () => {
  renderMermaidBlocks()
})
</script>

<template>
  <div class="scrollbar h-full min-h-0 overflow-y-auto">
    <div
      ref="markdownRef"
      class="markdown-content"
    >
      <div v-html="renderedContent" />
    </div>
  </div>
</template>

<style>
@reference '../../styles.css';

.markdown-content {
  @apply text-foreground p-4 font-sans;
  font-size: calc(1rem * var(--markdown-scale));
  line-height: 1.5;
}

.markdown-content h1 {
  @apply border-border text-foreground my-4 border-b pb-2 font-semibold first-of-type:mt-0;
  font-size: calc(2.25rem * var(--markdown-scale));
}

.markdown-content h2 {
  @apply border-border text-foreground my-5 border-b pb-2 font-semibold first-of-type:mt-0;
  font-size: calc(1.875rem * var(--markdown-scale));
}

.markdown-content h3 {
  @apply text-foreground my-6 font-semibold;
  font-size: calc(1.5rem * var(--markdown-scale));
}

.markdown-content h4 {
  @apply text-foreground my-7 font-semibold;
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
  @apply border-border text-muted-foreground mb-4 border-l-4 pl-4;
}

.markdown-content code {
  @apply rounded bg-[rgba(27,31,35,0.05)] px-1 py-0.5 dark:bg-[rgba(255,255,255,0.1)];
  font-size: calc(0.875rem * var(--markdown-scale));
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.markdown-content pre {
  @apply bg-muted dark:bg-muted mb-4 overflow-auto rounded p-4 leading-5;
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
  @apply border-border border-t;
}

.markdown-content td,
.markdown-content th {
  @apply border-border border p-2;
}

.markdown-content th {
  @apply bg-muted dark:bg-muted font-semibold;
}

.markdown-content tr:nth-child(2n) {
  @apply bg-muted dark:bg-muted;
}

.markdown-content img {
  @apply max-w-full;
}

.markdown-content hr {
  @apply border-border my-6 border-0 border-t;
}

.markdown-content .CodeMirror {
  @apply h-auto bg-transparent;
  font-size: calc(0.875rem * var(--markdown-scale));
  line-height: calc(0.875rem * var(--markdown-scale) * 1.5);
}

.markdown-content .code-block > div {
  @apply h-auto;
}
</style>
