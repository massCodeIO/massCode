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
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import hljs from 'highlight.js'
import mila from 'markdown-it-link-attributes'
import 'highlight.js/styles/github.css'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ipc } from '@/electron'

interface Props {
  value: string
}

const props = defineProps<Props>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()

let md: MarkdownIt
const forceRefresh = ref()

const init = () => {
  md = new MarkdownIt({
    html: true,
    langPrefix: 'language-',
    highlight (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${
            hljs.highlight(str, {
              language: lang,
              ignoreIllegals: true
            }).value
          }</code></pre>`
        } catch (err) {
          console.log(err)
        }
      }
      return `<pre class="hljs"><code>${MarkdownIt().utils.escapeHtml(
        str
      )}</code></pre>`
    }
  })

  md.use(mila, {
    attrs: {
      class: 'external'
    }
  })
}

const getRenderer = () => {
  const raw = md?.render(props.value)
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
        'class'
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
