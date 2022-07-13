<template>
  <div class="editor">
    <div
      ref="editorRef"
      class="main"
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
        Line {{ cursorPosition.row + 1 }}, Column
        {{ cursorPosition.column + 1 }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch
} from 'vue'
import type { Ace } from 'ace-builds'
import ace from 'ace-builds'
import './module-resolver'
import type { Language } from '@shared/types/renderer/editor'
import { languages } from './languages'
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import { ipc, track } from '@/electron'
import { emitter } from '@/composable'
import { useFolderStore } from '@/store/folders'

interface Props {
  lang: Language
  fragments: boolean
  fragmentIndex: number
  snippetId: string
  modelValue: string
  isSearchMode: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'update:lang', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  lang: 'typescript'
})

const emit = defineEmits<Emits>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()
const folderStore = useFolderStore()

const editorRef = ref()
const cursorPosition = reactive({
  row: 0,
  column: 0
})
let editor: Ace.Editor

const localLang = computed({
  get: () => props.lang,
  set: v => emit('update:lang', v)
})

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
  editor = ace.edit(editorRef.value, {
    theme: `ace/theme/${appStore.editor.theme}`,
    useWorker: false,
    fontSize: appStore.editor.fontSize,
    fontFamily: appStore.editor.fontFamily,
    printMargin: false,
    tabSize: appStore.editor.tabSize,
    wrap: appStore.editor.wrap,
    showInvisibles: appStore.editor.showInvisibles,
    highlightGutterLine: appStore.editor.highlightGutter,
    highlightActiveLine: appStore.editor.highlightLine
  })

  setValue()
  setLang()

  // Удаляем некторые шорткаты
  // @ts-ignore
  editor.commands.removeCommand('find')
  editor.commands.removeCommand('gotoline')
  editor.commands.removeCommand('showSettingsMenu')

  // События
  editor.on('change', () => {
    emit('update:modelValue', editor.getValue())
  })
  editor.selection.on('changeCursor', () => {
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

  // Фиксированный размер для колонки чисел строк
  // @ts-ignore
  editor.session.gutterRenderer = {
    getWidth: () => 20,
    getText: (session: any, row: number) => {
      return row + 1
    }
  }
}

const setValue = () => {
  const pos = editor.session.selection.toJSON()
  editor.setValue(props.modelValue)
  editor.session.selection.fromJSON(pos)

  if (snippetStore.searchQuery) {
    findAll(snippetStore.searchQuery)
  }
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
  if (props.lang === 'jade') parser = 'pug'
  if (shellLike.includes(props.lang)) parser = 'sh'

  try {
    const formatted = await ipc.invoke('main:prettier', {
      source: props.modelValue,
      parser
    })
    await snippetStore.patchCurrentSnippetContentByKey('value', formatted)
    setValue()
    track('snippets/format')
  } catch (err) {
    console.error(err)
  }
}

const setLang = () => {
  editor.session.setMode(`ace/mode/${localLang.value}`)
  track('snippets/set-language', localLang.value)
}

const resetUndoStack = () => {
  editor.getSession().setUndoManager(new ace.UndoManager())
}

const setCursorToStartAndClearSelection = () => {
  editor.moveCursorTo(0, 0)
  editor.clearSelection()
}

const findAll = (q: string) => {
  if (q === '') return

  const prevMarks = editor.session.getMarkers()

  if (prevMarks) {
    for (const i of Object.keys(prevMarks)) {
      editor.session.removeMarker(prevMarks[Number(i)].id)
    }
  }

  editor.findAll(q, { caseSensitive: false, preventScroll: true })
}

const getCursorPosition = () => {
  const { row, column } = editor.getCursorPosition()
  cursorPosition.row = row
  cursorPosition.column = column
}

onMounted(() => {
  init()
})

watch(
  () => props.lang,
  () => setLang()
)

watch(
  () => [props.snippetId, props.fragmentIndex].concat(),
  () => setValue()
)

watch(
  () => snippetStore.searchQuery,
  v => {
    if (v) findAll(v)
  }
)

watch(
  () => [props.snippetId, props.fragmentIndex],
  () => {
    resetUndoStack()
    if (!props.isSearchMode) {
      setCursorToStartAndClearSelection()
    }
  }
)

watch(
  () => snippetStore.isCodePreview,
  () => {
    // Пока не нашел другого способа обновить высоту редактора в этом случае.
    // Странно то, что при ресайзе окна, высота редактора корректно высчитывается
    const scrollTop = editor.session.getScrollTop()

    editor.destroy()
    nextTick(() => {
      init()
      editor.session.setScrollTop(scrollTop)
    })
  }
)

emitter.on('snippet:format', () => format())

onUnmounted(() => {
  emitter.off('snippet:format')
})

window.addEventListener('resize', () => {
  forceRefresh.value = Math.random()
})
</script>

<style lang="scss" scoped>
.editor {
  padding-top: 4px;
  .main {
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
