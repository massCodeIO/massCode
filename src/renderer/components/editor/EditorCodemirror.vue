<template>
  <div class="editor">
    <div
      ref="editorRef"
      class="body"
    />
    <div class="footer">
      <span>
        <select
          v-model="localLang"
          class="lang-selector"
        >
          <option
            v-for="i in languages"
            :key="i.value"
            :value="i.value"
          >
            {{ i.name }}
          </option>
        </select>
      </span>
      <span>
        {{ i18n.t('line') }} {{ cursorPosition.row + 1 }},
        {{ i18n.t('column') }}
        {{ cursorPosition.column + 1 }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import CodeMirror from 'codemirror'
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/matchbrackets'
import 'codemirror/addon/search/search'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/selection/active-line'
import 'codemirror/addon/scroll/simplescrollbars'
import 'codemirror/addon/scroll/simplescrollbars.css'
import 'codemirror/lib/codemirror.css'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch
} from 'vue'
import { i18n, ipc } from '@/electron'
import { track } from '@/services/analytics'
import { languages } from './languages'
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import { loadThemes, getThemeName } from './themes'
import type { Language } from '@shared/types/renderer/editor'
import { emitter } from '@/composable'
import { useFolderStore } from '@/store/folders'
import { useDebounceFn } from '@vueuse/core'

interface Props {
  lang: Language
  fragments: boolean
  fragmentIndex: number
  snippetId: string
  modelValue: string
  isSearchMode: boolean
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'update:lang', value: string): void
}

const emit = defineEmits<Emits>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()
const folderStore = useFolderStore()

const editorRef = ref()
const scrollBarOpacity = ref(1)
let editor: CodeMirror.Editor

const localLang = computed({
  get: () => props.lang,
  set: v => emit('update:lang', v)
})

const cursorPosition = reactive({
  row: 0,
  column: 0
})

const fontSize = computed(() => appStore.editor.fontSize + 'px')
const fontFamily = computed(() => appStore.editor.fontFamily)

const forceRefresh = ref()

const editorHeight = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  forceRefresh.value

  let result =
    appStore.sizes.titlebar +
    appStore.sizes.editor.titleHeight +
    appStore.sizes.editor.footerHeight

  if (snippetStore.isFragmentsShow) {
    result += appStore.sizes.editor.fragmentsHeight
  }

  if (snippetStore.isTagsShow) {
    result += appStore.sizes.editor.tagsHeight
  }

  if (snippetStore.isDescriptionShow) {
    result += appStore.sizes.editor.descriptionHeight
  }

  if (snippetStore.isCodePreview) {
    result += appStore.sizes.codePreviewHeight
  }

  return window.innerHeight - result + 'px'
})

const footerHeight = computed(() => appStore.sizes.editor.footerHeight + 'px')

const init = async () => {
  await loadThemes()

  editor = CodeMirror(editorRef.value, {
    value: props.modelValue,
    mode: props.lang,
    theme: getThemeName(appStore.theme) || 'GitHub',
    lineWrapping: Boolean(appStore.editor.wrap),
    lineNumbers: true,
    tabSize: appStore.editor.tabSize,
    autoCloseBrackets: true,
    matchBrackets: appStore.editor.matchBrackets,
    styleActiveLine: appStore.editor.highlightLine,
    scrollbarStyle: 'null'
  })

  editor.on('change', () => {
    emit('update:modelValue', editor.getValue())
  })

  editor.on('cursorActivity', () => {
    getCursorPosition()
  })

  editor.on('focus', async () => {
    if (snippetStore.searchQuery?.length) {
      snippetStore.searchQuery = undefined
      folderStore.selectId(snippetStore.selected!.folderId)
      await snippetStore.setSnippetsByFolderIds()
      emitter.emit('scroll-to:snippet', snippetStore.selectedId!)
    }
  })

  editor.on('scroll', () => {
    scrollBarOpacity.value = 1
    editor.setOption('scrollbarStyle', 'overlay')
  })
  editor.on('scroll', hideScrollbar)

  editor.on('paste', async (cm, e) => {
    if (props.lang === 'markdown') {
      const item = e.clipboardData?.items[0]

      if (item?.type.startsWith('image')) {
        e.preventDefault()

        const blob = item.getAsFile()
        const path = await ipc.invoke('main:copy-to-assets', blob?.path)

        cm.replaceSelection(`![](./${path})`)
      }
    }
  })

  editor.setOption('extraKeys', {
    'Cmd-F': () => {
      emitter.emit('search:focus', true)
    }
  })

  if (snippetStore.searchQueryEscaped) {
    findAll(snippetStore.searchQueryEscaped)
  }
}

const setValue = (value: string) => {
  if (!editor) return

  const cursor = editor.getCursor()
  editor.setValue(value)

  if (cursor) editor.setCursor(cursor)
}

const setLang = (lang: string) => {
  if (!editor) return
  editor.setOption('mode', lang)
}

const getCursorPosition = () => {
  const { line, ch } = editor.getCursor()
  cursorPosition.row = line
  cursorPosition.column = ch
}

const findAll = (query: string) => {
  if (!editor || query === '') return

  query = query.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')

  const re = new RegExp(query, 'i')
  const cursor = editor.getSearchCursor(re)

  clearAllMarks()

  while (cursor.findNext()) {
    editor.markText(cursor.from(), cursor.to(), {
      className: appStore.isLightTheme ? 'mark mark--light' : 'mark'
    })
  }
}

const clearAllMarks = () => {
  if (!editor) return

  const marks = editor.getAllMarks()

  if (marks) {
    marks.forEach(i => i.clear())
  }
}

const clearHistory = () => {
  if (!editor) return
  editor.clearHistory()
}

const format = async () => {
  const availableLang: Language[] = [
    'css',
    'dockerfile',
    'gitignore',
    'graphqlschema',
    'html',
    'ini',
    'jade',
    'java',
    'javascript',
    'json',
    'json5',
    'less',
    'markdown',
    'php',
    'properties',
    'sass',
    'scss',
    'sh',
    'toml',
    'typescript',
    'xml',
    'yaml'
  ]

  if (!availableLang.includes(props.lang)) return

  let parser = props.lang as string
  const shellLike = ['dockerfile', 'gitignore', 'properties', 'ini']

  if (props.lang === 'javascript') parser = 'babel'
  if (props.lang === 'graphqlschema') parser = 'graphql'
  if (shellLike.includes(props.lang)) parser = 'sh'

  try {
    const formatted = await ipc.invoke('main:prettier', {
      source: props.modelValue,
      parser
    })
    await snippetStore.patchCurrentSnippetContentByKey('value', formatted)
    setValue(formatted)
    track('snippets/format')
  } catch (err) {
    console.error(err)
  }
}

const hideScrollbar = useDebounceFn(() => {
  scrollBarOpacity.value = 0
}, 1000)

watch(
  () => [props.snippetId, props.fragmentIndex],
  () => {
    setValue(props.modelValue)

    if (snippetStore.searchQueryEscaped) {
      findAll(snippetStore.searchQueryEscaped)
    }

    clearHistory()
  }
)

watch(
  () => props.lang,
  () => {
    setLang(props.lang)
  }
)

watch(
  () => snippetStore.searchQueryEscaped,
  v => {
    if (v) {
      findAll(v)
    } else {
      clearAllMarks()
    }
  }
)

watch(
  () => appStore.editor.fontSize,
  () => {
    nextTick(() => editor.refresh())
  }
)

emitter.on('snippet:format', () => format())

onMounted(() => {
  init()

  window.addEventListener('resize', () => {
    forceRefresh.value = Math.random()
  })
})

onUnmounted(() => {
  emitter.off('snippet:format')
})
</script>

<style lang="scss" scoped>
.editor {
  padding-top: 4px;
  height: 100%;
  :deep(.CodeMirror) {
    height: 100%;
    font-size: v-bind(fontSize);
    font-family: v-bind(fontFamily);
    line-height: calc(v-bind(fontSize) * 1.5);
  }
  :deep(.CodeMirror-overlayscroll-vertical div) {
    background-color: rgba(121, 121, 121, 0.8);
    width: 5px;
    opacity: v-bind(scrollBarOpacity);
    transition: opacity 0.3s;
  }
  :deep(.CodeMirror-overlayscroll-horizontal div) {
    background-color: rgba(121, 121, 121, 0.8);
    height: 5px;
    opacity: v-bind(scrollBarOpacity);
    transition: opacity 0.3s;
  }
  :deep(.CodeMirror-scrollbar-filler) {
    background-color: transparent;
  }
  :deep(.mark) {
    background-color: yellow;
    color: #000;
    border-radius: 2px;
  }
  :deep(.mark--light) {
    background-color: var(--color-primary);
    color: #fff;
  }
  .body {
    height: v-bind(editorHeight);
  }
  .footer {
    height: v-bind(footerHeight);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--spacing-xs);
    font-size: 12px;
    select {
      background-color: var(--color-bg);
    }
  }
}
.lang-selector {
  -webkit-appearance: none;
  border: 0;
  outline: none;
  color: var(--color-text);
}
</style>
