<template>
  <div
    class="editor"
    :class="{ 'with-fragments': fragments }"
  >
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
import type { Language } from './types'
import { languages, oldLanguageMap } from './languages'

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
  theme: 'chrome',
  fragments: false
})

const emit = defineEmits<Emits>()

const editorRef = ref()
const cursorPosition = reactive({
  row: 0,
  column: 0
})
let editor: Ace.Editor

const localLang = computed({
  get: () => oldLanguageMap[props.lang] || props.lang,
  set: v => emit('update:lang', v)
})

const init = async () => {
  editor = ace.edit(editorRef.value, {
    theme: `ace/theme/${props.theme}`,
    useWorker: false,
    fontSize: 12,
    printMargin: false,
    tabSize: 2
  })

  setValue()

  // Убираем вызов поиска
  editor.commands.removeCommand('find')

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
}

const setLang = () => {
  editor.session.setMode(`ace/mode/${localLang.value}`)
}

const setTheme = () => {
  editor.session.setMode(`ace/theme/${props.theme}`)
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
</script>

<style lang="scss" scoped>
.editor {
  padding-top: 4px;
  &.with-fragments {
    .main {
      height: calc(
        100vh - var(--title-bar-height) - var(--snippets-view-header-top-height) -
          var(--snippets-view-footer-height) -
          var(--snippet-header-fragment-height)
      );
    }
  }
  .main {
    height: calc(
      100vh - var(--title-bar-height) - var(--snippets-view-header-top-height) -
        var(--snippets-view-footer-height)
    );
  }
  .footer {
    height: 30px;
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
