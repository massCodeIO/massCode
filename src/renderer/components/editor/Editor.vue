<script setup lang="ts">
import type { Language } from '@/components/editor/types'
import {
  useApp,
  useEditor,
  useSnippets,
  useSnippetUpdate,
} from '@/composables'
import { i18n, ipc } from '@/electron'
import { useClipboard, useCssVar, useDark, useDebounceFn } from '@vueuse/core'
import CodeMirror from 'codemirror'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'radix-vue'
import { EDITOR_DEFAULTS } from '~/main/store/constants'
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

const { settings, cursorPosition } = useEditor()
const {
  selectedSnippetContent,
  selectedSnippet,
  isEmpty,
  selectedSnippetIds,
  isAvailableToCodePreview,
} = useSnippets()
const {
  isShowMarkdown,
  isShowMindmap,
  isShowCodePreview,
  isShowCodeImage,
  isShowMarkdownPresentation,
  isFocusedSearch,
} = useApp()

const { addToUpdateContentQueue } = useSnippetUpdate()

const isDark = useDark()
let editor: CodeMirror.Editor | null = null

const isProgrammaticChange = ref(false)

const fontSize = useCssVar('--editor-font-size', document.body, {
  initialValue: `${settings.fontSize}px`,
})

useCssVar('--editor-font-family', document.body, {
  initialValue: settings.fontFamily,
})

const scrollBarOpacity = useCssVar(
  '--editor-scrollbar-opacity',
  document.body,
  {
    initialValue: '1',
  },
)

const isShowHeader = computed(() => {
  return (
    isShowMarkdown.value
    || isShowMindmap.value
    || (!isEmpty.value && selectedSnippet.value !== undefined)
  )
})
const isShowEditor = computed(() => {
  return (
    !isShowMarkdown.value
    && !isShowMindmap.value
    && !isShowCodeImage.value
    && !isShowMarkdownPresentation.value
    && !isEmpty.value
    && selectedSnippet.value !== undefined
  )
})

watch(selectedSnippetContent, () => {
  if (selectedSnippetContent.value?.language !== 'markdown') {
    isShowMarkdown.value = false
    isShowMindmap.value = false
  }

  if (!isAvailableToCodePreview.value) {
    isShowCodePreview.value = false
  }
})

function getCursorPosition() {
  if (!editor)
    return
  const { line, ch } = editor.getCursor()
  cursorPosition.row = line
  cursorPosition.column = ch
}

const hideScrollbar = useDebounceFn(() => {
  scrollBarOpacity.value = '0'
}, 1000)

async function init() {
  const el = document.getElementById('editor')

  if (!el)
    return

  editor = CodeMirror(el, {
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
    if (isProgrammaticChange.value || !selectedSnippet.value?.id)
      return

    const initValue = JSON.stringify(selectedSnippetContent.value?.value)
    const updatedValue = JSON.stringify(e.getValue())

    if (initValue !== updatedValue) {
      addToUpdateContentQueue(
        selectedSnippet.value.id,
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
    scrollBarOpacity.value = '1'
    editor?.setOption('scrollbarStyle', 'overlay')
  })

  editor.on('scroll', hideScrollbar)

  editor.on('drop', async (cm, e) => {
    if (selectedSnippetContent.value?.language === 'markdown') {
      const file = e.dataTransfer?.files[0]

      if (!file)
        return

      if (!file.type.startsWith('image/'))
        return

      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Array.from(new Uint8Array(arrayBuffer))

        // Вызываем IPC хендлер для сохранения файла из буфера
        const relativePath = await ipc.invoke('fs:assets', {
          buffer,
          fileName: file.name,
        })

        cm.replaceSelection(`![${file.name}](./${relativePath})`)
      }
      catch (error) {
        console.error('Ошибка при добавлении изображения:', error)
      }
    }
  })

  editor.setOption('extraKeys', {
    'Cmd-F': () => {
      isFocusedSearch.value = true
    },
  })

  ipc.on('main-menu:font-size-increase', () => {
    settings.fontSize++
    fontSize.value = `${settings.fontSize}px`
  })

  ipc.on('main-menu:font-size-decrease', () => {
    settings.fontSize--
    fontSize.value = `${settings.fontSize}px`
  })

  ipc.on('main-menu:font-size-reset', () => {
    settings.fontSize = EDITOR_DEFAULTS.fontSize
    fontSize.value = `${settings.fontSize}px`
  })

  ipc.on('main-menu:copy-snippet', () => {
    const { copy } = useClipboard({ source: editor?.getValue() || '' })
    copy()
  })

  watch(selectedSnippetContent, (v) => {
    nextTick(() => {
      setValue(v?.value || '')
    })
  })

  watch(selectedSnippetContent, (v) => {
    nextTick(() => {
      if (!v)
        return
      setLanguage(v.language as Language)
    })
  })

  watch(isDark, (v) => {
    if (v) {
      editor?.setOption('theme', 'oceanic-next')
    }
    else {
      editor?.setOption('theme', 'neo')
    }
  })

  watch(
    () => settings.fontSize,
    () => {
      nextTick(() => {
        editor?.refresh()
      })
    },
  )
}

function setValue(value: string, programmatic = true) {
  if (!editor)
    return

  const cursor = editor.getCursor()

  isProgrammaticChange.value = programmatic
  editor?.setValue(value)

  nextTick(() => {
    isProgrammaticChange.value = false
  })

  if (cursor)
    editor.setCursor(cursor)
}

function setLanguage(language: Language) {
  editor?.setOption('mode', language)
}

async function format() {
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
    'yaml',
  ]

  if (
    selectedSnippetContent.value?.value
    && !selectedSnippetContent.value?.language
  ) {
    return
  }

  if (
    !availableLang.includes(selectedSnippetContent.value?.language as Language)
  )
    return

  const lang = selectedSnippetContent.value?.language as Language
  const value = selectedSnippetContent.value?.value
  let parser = lang as string

  const shellLike = ['dockerfile', 'gitignore', 'properties', 'ini']

  if (lang === 'javascript')
    parser = 'babel'
  if (lang === 'graphqlschema')
    parser = 'graphql'
  if (shellLike.includes(lang))
    parser = 'sh'

  try {
    const formatted = await ipc.invoke('prettier:format', {
      text: value,
      parser,
    })
    setValue(formatted, false)
  }
  catch (err) {
    console.error(err)
  }
}

ipc.on('main-menu:format', format)

function onSplitterLayout() {
  editor?.refresh()
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
    <EditorHeader v-if="isShowHeader" />
    <SplitterGroup
      v-show="isShowEditor"
      direction="vertical"
      class="overflow-auto"
      @layout="onSplitterLayout"
    >
      <SplitterPanel as-child>
        <div
          id="editor"
          data-editor-mount
        />
      </SplitterPanel>
      <SplitterResizeHandle class="relative cursor-none">
        <UiGutter orientation="horizontal" />
      </SplitterResizeHandle>
      <SplitterPanel v-if="isShowCodePreview">
        <EditorPreview />
      </SplitterPanel>
    </SplitterGroup>
    <EditorMarkdown v-if="isShowMarkdown" />
    <EditorFooter v-if="isShowEditor" />
    <EditorMindmap v-if="isShowMindmap" />
    <EditorCodeImage v-if="isShowCodeImage" />
    <div
      v-if="
        isEmpty
          || selectedSnippetIds.length > 1
          || selectedSnippet === undefined
      "
      class="row-span-full flex items-center justify-center"
    >
      <UiEmptyPlaceholder
        v-if="isEmpty || selectedSnippet === undefined"
        :text="i18n.t('snippet.noSelected')"
      />
      <UiEmptyPlaceholder
        v-if="!isEmpty && selectedSnippetIds.length > 1"
        :text="
          i18n.t('snippet.selectedMultiple', {
            count: selectedSnippetIds.length,
          })
        "
      />
    </div>
  </div>
</template>

<style>
@reference '../../styles.css';
.CodeMirror {
  font-size: var(--editor-font-size);
  font-family: var(--editor-font-family);
  line-height: calc(var(--editor-font-size) * 1.5);
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
  opacity: var(--editor-scrollbar-opacity);
  transition: opacity 0.3s;
}

.CodeMirror-overlayscroll-horizontal div {
  background-color: var(--color-scrollbar);
  height: 7px;
  opacity: var(--editor-scrollbar-opacity);
  transition: opacity 0.3s;
}

.CodeMirror-scrollbar-filler {
  background-color: transparent;
}
</style>
