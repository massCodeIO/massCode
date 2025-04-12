<script setup lang="ts">
import { useSnippets } from '@/composables'
import { ipc } from '@/electron'
import { useDark } from '@vueuse/core'
import CodeMirror from 'codemirror'
import { marked } from 'marked'
import mermaid from 'mermaid'
import sanitizeHtml from 'sanitize-html'
import { nextTick, ref, watch } from 'vue'
import 'codemirror/addon/runmode/runmode'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

const { selectedSnippetContent } = useSnippets()
const isDark = useDark()

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
      if (/^masscode:\/\/snippets/.test(href)) {
        const id = href.split('/').pop()
        return `<a href="${href}" class="snippet-link" data-snippet-id="${id}">${text}</a>`
      }
      else {
        return `<a href="${href}" class="external">${text}</a>`
      }
    },
  },
})

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
    if (href) {
      if (target.classList.contains('snippet-link')) {
        const snippetId = target.getAttribute('data-snippet-id')
        if (snippetId) {
          // TODO: Implement snippet link

          event.preventDefault()
        }
      }
      else if (target.classList.contains('external')) {
        ipc.invoke('system:open-external', href)
        event.preventDefault()
      }
    }
  }
}

watch(
  selectedSnippetContent,
  async () => {
    if (selectedSnippetContent.value?.value) {
      const markdownHtml = await marked.parse(
        selectedSnippetContent.value.value,
      )

      const sanitizedHtml = sanitizeHtml(markdownHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
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

      renderedContent.value = sanitizedHtml
    }
    else {
      renderedContent.value = ''
      codeEditors.value = []
      codeBlocksData.value = []
    }
  },
  { immediate: true },
)

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
  <PerfectScrollbar :options="{ minScrollbarLength: 20 }">
    <div
      ref="markdownRef"
      class="markdown-content"
    >
      <div v-html="renderedContent" />
    </div>
  </PerfectScrollbar>
</template>

<style scoped>
@reference '../../../styles.css';
.markdown-content {
  @apply overflow-auto p-4 font-sans text-base leading-6 text-[var(--color-text)];
}

.markdown-content :deep(h1) {
  @apply my-4 border-b border-[var(--color-border)] pb-2 text-4xl font-semibold text-[var(--color-text)] first-of-type:mt-0;
}

.markdown-content :deep(h2) {
  @apply my-5 border-b border-[var(--color-border)] pb-2 text-3xl font-semibold text-[var(--color-text)] first-of-type:mt-0;
}

.markdown-content :deep(h3) {
  @apply my-6 text-2xl font-semibold text-[var(--color-text)];
}

.markdown-content :deep(h4) {
  @apply my-7 text-xl font-semibold text-[var(--color-text)];
}

.markdown-content :deep(p) {
  @apply mb-4;
}

.markdown-content :deep(a) {
  @apply text-blue-600 no-underline dark:text-blue-400;
}

.markdown-content :deep(a:hover) {
  @apply underline;
}

.markdown-content :deep(strong) {
  @apply font-semibold;
}

.markdown-content :deep(em) {
  @apply italic;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  @apply mb-4 ml-8 pl-0;
}

.markdown-content :deep(ul ul),
.markdown-content :deep(ol ol),
.markdown-content :deep(ul ol),
.markdown-content :deep(ol ul) {
  @apply mb-0;
}

.markdown-content :deep(li) {
  @apply mb-1;
}

.markdown-content :deep(blockquote) {
  @apply mb-4 border-l-4 border-[var(--color-border)] pl-4 text-[var(--color-text-muted)];
}

.markdown-content :deep(code) {
  @apply rounded bg-[rgba(27,31,35,0.05)] px-1 py-0.5 text-sm dark:bg-[rgba(255,255,255,0.1)];
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.markdown-content :deep(pre) {
  @apply mb-4 overflow-auto rounded bg-[var(--color-button)] p-4 text-sm leading-5 dark:bg-[var(--color-button)];
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.markdown-content :deep(pre code) {
  @apply m-0 border-0 bg-transparent p-0 text-base;
}

.markdown-content :deep(table) {
  @apply mb-4 block border-collapse overflow-x-auto;
}

.markdown-content :deep(tr) {
  @apply border-t border-[var(--color-border)];
}

.markdown-content :deep(td),
.markdown-content :deep(th) {
  @apply border border-[var(--color-border)] p-2;
}

.markdown-content :deep(th) {
  @apply bg-[var(--color-button)] font-semibold dark:bg-[var(--color-button)];
}

.markdown-content :deep(tr:nth-child(2n)) {
  @apply bg-[var(--color-button)] dark:bg-[var(--color-button)];
}

.markdown-content :deep(img) {
  @apply box-content max-w-full;
}

.markdown-content :deep(hr) {
  @apply my-6 h-1 border-0 bg-[var(--color-border)] p-0;
}

.markdown-content :deep(.CodeMirror) {
  @apply !bg-markdown-code overflow-auto rounded-md p-4 text-sm leading-5;
}

.markdown-content :deep(.code-block) > div {
  @apply overflow-hidden;
}
</style>
