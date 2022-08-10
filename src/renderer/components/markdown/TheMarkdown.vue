<template>
  <div class="markdown markdown-body">
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ipc, store } from '@/electron'
import { marked } from 'marked'
import mermaid from 'mermaid'
import { useHljsTheme } from '@/composable'

const isDev = import.meta.env.DEV

interface Props {
  value: string
  scale?: number
}

const props = withDefaults(defineProps<Props>(), {
  scale: 1
})

const appStore = useAppStore()
const snippetStore = useSnippetStore()

const forceRefresh = ref()
const preTagBg = computed(() =>
  appStore.isLightTheme ? '#fff' : 'var(--color-contrast-high)'
)

const init = () => {
  const renderer: marked.RendererObject = {
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
  let html = sanitizeHtml(raw, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'h7',
      'h8',
      'br',
      'b',
      'i',
      'strong',
      'em',
      'a',
      'pre',
      'code',
      'img',
      'tt',
      'div',
      'ins',
      'del',
      'sup',
      'sub',
      'p',
      'ol',
      'ul',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'blockquote',
      'dl',
      'dt',
      'dd',
      'kbd',
      'q',
      'samp',
      'var',
      'hr',
      'ruby',
      'rt',
      'rp',
      'li',
      'tr',
      'td',
      'th',
      's',
      'strike',
      'summary',
      'details',
      'caption',
      'figure',
      'figcaption',
      'abbr',
      'bdo',
      'cite',
      'dfn',
      'mark',
      'small',
      'span',
      'time',
      'wbr',
      'input'
    ],
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

  const re = /src="\.\//g
  const path = store.preferences.get('storagePath')

  html = isDev
    ? html.replace(re, `src="file://${path}/`)
    : html.replace(re, `src="${path}/`)

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

watch(
  () => appStore.isLightTheme,
  v => {
    if (v) {
      useHljsTheme('light')
    } else {
      useHljsTheme('dark')
    }
  },
  { immediate: true }
)

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
  &-body {
    --scale: v-bind(props.scale);
  }
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
