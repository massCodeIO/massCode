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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Ace } from 'ace-builds'
import ace from 'ace-builds'
import './module-resolver'
import type { Language } from '@shared/types/renderer/editor'
import { languages } from './languages'
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'

interface Props {
  lang: Language
  theme: string
  fragments: boolean
  modelValue: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'update:lang', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  lang: 'typescript',
  theme: 'chrome'
})

const emit = defineEmits<Emits>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()

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

const footerHeight = computed(() => appStore.sizes.editor.footerHeight + 'px')

const init = async () => {
  editor = ace.edit(editorRef.value, {
    theme: `ace/theme/${props.theme}`,
    useWorker: false,
    fontSize: 12,
    printMargin: false,
    tabSize: 2
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

const setLang = () => {
  editor.session.setMode(`ace/mode/${localLang.value}`)
}

const setTheme = () => {
  editor.session.setMode(`ace/theme/${props.theme}`)
}

const findAll = (q: string) => {
  if (q === '') return
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
  () => props.modelValue,
  () => setValue()
)

watch(
  () => snippetStore.searchQuery,
  v => {
    if (v) findAll(v)
  }
)

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
  }
}
.lang-selector {
  -webkit-appearance: none;
  border: 0;
  outline: none;
}
</style>
