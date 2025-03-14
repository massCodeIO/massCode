<script setup lang="ts">
import type { Language } from '@/components/editor/types'
import { useEditor, useSnippets, useSnippetUpdate } from '@/composables'
import { i18n } from '@/electron'
import { useDark, useDebounceFn } from '@vueuse/core'
import CodeMirror from 'codemirror'
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/matchbrackets'
import 'codemirror/addon/search/search'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/selection/active-line'
import 'codemirror/addon/scroll/simplescrollbars'
import 'codemirror/addon/scroll/simplescrollbars.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

interface Props {
  lang: Language
  fragments: boolean
  fragmentIndex: number
  snippetId: string
  modelValue: string
  isSearchMode: boolean
}

defineProps<Props>()

const { settings, cursorPosition } = useEditor()
const { selectedSnippetContent, selectedSnippet, isEmpty } = useSnippets()

const { addToUpdateContentQueue } = useSnippetUpdate()

const isDark = useDark()
let editor: CodeMirror.Editor | null = null

const editorRef = ref()
const scrollBarOpacity = ref(1)

const fontSize = computed(() => `${settings.fontSize}px`)
const fontFamily = computed(() => settings.fontFamily)

function getCursorPosition() {
  if (!editor)
    return
  const { line, ch } = editor.getCursor()
  cursorPosition.row = line
  cursorPosition.column = ch
}

const hideScrollbar = useDebounceFn(() => {
  scrollBarOpacity.value = 0
}, 1000)

async function init() {
  editor = CodeMirror(editorRef.value, {
    value: selectedSnippetContent.value?.value || ' ',
    mode: selectedSnippetContent.value?.language || 'plain_text',
    theme: isDark.value ? 'oceanic-next' : 'neo',
    lineWrapping: settings.wrap,
    lineNumbers: true,
    tabSize: settings.tabSize,
    autoCloseBrackets: true,
    matchBrackets: settings.matchBrackets,
    styleActiveLine: settings.highlightLine,
    scrollbarStyle: 'null',
  })

  editor.on('change', (e) => {
    const initValue = JSON.stringify(selectedSnippetContent.value?.value)
    const updatedValue = JSON.stringify(e.getValue())

    if (initValue !== updatedValue) {
      addToUpdateContentQueue(
        selectedSnippet.value!.id,
        selectedSnippetContent.value!.id,
        {
          label: selectedSnippetContent.value!.label,
          value: e.getValue(),
          language: selectedSnippetContent.value!.language,
        },
      )
    }
  })

  editor.on('cursorActivity', getCursorPosition)

  editor.on('scroll', () => {
    scrollBarOpacity.value = 1
    editor?.setOption('scrollbarStyle', 'overlay')
  })

  editor.on('scroll', hideScrollbar)

  watch(selectedSnippetContent, (v) => {
    if (!v?.value)
      return
    setValue(v.value)
  })

  watch(selectedSnippetContent, (v) => {
    if (!v)
      return
    setLanguage(v.language as Language)
  })

  watch(isDark, (v) => {
    if (v) {
      editor?.setOption('theme', 'oceanic-next')
    }
    else {
      editor?.setOption('theme', 'neo')
    }
  })
}

function setValue(value: string) {
  if (!editor)
    return

  const cursor = editor.getCursor()
  editor?.setValue(value)

  if (cursor)
    editor.setCursor(cursor)
}

function setLanguage(language: Language) {
  editor?.setOption('mode', language)
}

onMounted(() => {
  init()
})
</script>

<template>
  <div
    data-editor
    class="mt-[var(--title-bar-height)] grid grid-rows-[auto_1fr_auto] overflow-hidden"
  >
    <EditorHeader v-if="!isEmpty" />
    <div
      v-show="!isEmpty"
      ref="editorRef"
      class="overflow-auto"
    />
    <EditorFooter v-if="!isEmpty" />
    <div
      v-if="isEmpty"
      class="row-span-full flex items-center justify-center"
    >
      {{ i18n.t("snippet.noSelected") }}
    </div>
  </div>
</template>

<style>
@reference '../../styles.css';
.CodeMirror {
  font-size: v-bind(fontSize);
  font-family: v-bind(fontFamily);
  line-height: calc(v-bind(fontSize) * 1.5);
  height: 100%;
  background-color: var(--color-bg) !important;
}

.CodeMirror-gutters {
  background-color: var(--color-bg) !important;
}

.CodeMirror-linenumber {
  color: var(--color-text-muted) !important;
}

.CodeMirror-cursor {
  border-left: 2px solid var(--color-fg) !important;
  background-color: transparent !important;
}

.CodeMirror-selected {
  background-color: var(--color-list-selection) !important;
}

.CodeMirror-overlayscroll-vertical div {
  background-color: var(--color-scrollbar);
  width: 7px;
  opacity: v-bind(scrollBarOpacity);
  transition: opacity 0.3s;
}

.CodeMirror-overlayscroll-horizontal div {
  background-color: var(--color-scrollbar);
  height: 7px;
  opacity: v-bind(scrollBarOpacity);
  transition: opacity 0.3s;
}

.CodeMirror-scrollbar-filler {
  background-color: transparent;
}
</style>
