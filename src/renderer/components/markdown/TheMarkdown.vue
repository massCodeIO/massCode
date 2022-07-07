<template>
  <div class="markdown markdown-github">
    <PerfectScrollbar>
      <div v-html="renderer" />
    </PerfectScrollbar>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import sanitizeHtml from 'sanitize-html'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ipc } from '@/electron'
import { marked } from 'marked'
import mermaid from 'mermaid'

interface Props {
  value: string
}

const props = defineProps<Props>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()

const forceRefresh = ref()

const init = () => {
  const renderer = {
    code (code: string, lang: string) {
      if (lang === 'mermaid') {
        return `<div class="mermaid">${code}</div><br>`
      } else {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext'
        return `<pre><code class="language-${lang}">${
          hljs.highlight(code, { language }).value
        }</code></pre>`
      }
    },
    link (href: string, title: string, text: string) {
      return `<a href="${href}" class="external">${text}</a>`
    }
  }

  marked.use({ renderer })
}

const initMermaid = () => {
  try {
    mermaid.initialize({
      // @ts-ignore
      theme: appStore.theme.match(/^dark/) ? 'dark' : 'default',
      startOnLoad: true
    })
    mermaid.init('.mermaid')
  } catch (err) {}
}

onMounted(() => {
  initMermaid()
})

const getRenderer = () => {
  const raw = marked.parse(props.value)
  const html = sanitizeHtml(raw, {
    allowedTags: false,
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
        'disabled'
      ]
    }
  })
  return html
}

const renderer = computed(() => getRenderer())

const openExternal = (e: Event) => {
  const el = e.target as HTMLAnchorElement
  e.preventDefault()
  if (el.classList.contains('external')) {
    ipc.invoke('main:open-url', el.href)
  }
}

const height = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  forceRefresh.value

  let result =
    appStore.sizes.editor.titleHeight +
    appStore.sizes.titlebar +
    appStore.sizes.editor.footerHeight

  if (snippetStore.isFragmentsShow) {
    result += appStore.sizes.editor.fragmentsHeight
  }

  if (snippetStore.isTagsShow) {
    result += appStore.sizes.editor.tagsHeight
  }

  return window.innerHeight - result + 'px'
})

init()

onMounted(() => {
  document.addEventListener('click', openExternal)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', openExternal)
})

window.addEventListener('resize', () => {
  forceRefresh.value = Math.random()
})
</script>

<style lang="scss" scoped>
.markdown {
  padding: 0 var(--spacing-xs);
  :deep(h1, h2, h3, h4, h5, h6) {
    &:first-child {
      margin-top: 0;
    }
  }
  :deep(.ps) {
    height: v-bind(height);
  }
}
</style>
