<script setup lang="ts">
import type { Extension } from '@codemirror/state'
import { notesEditorScrollbarTheme } from '@/components/notes/cm-extensions/scrollbarTheme'
import { useHttpEnvironments } from '@/composables'
import { i18n } from '@/electron'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { indentUnit } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import {
  refreshVariables,
  varInterpolationExtension,
} from './cm-extensions/varInterpolation'

interface Props {
  language?: 'json' | 'text' | 'form-urlencoded'
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  language: 'text',
})

const model = defineModel<string>({ default: '' })
const editorContainer = ref<HTMLElement>()

const { activeEnvironment } = useHttpEnvironments()

let view: EditorView | null = null
let isApplyingExternalValue = false
const languageCompartment = new Compartment()

function getVariables(): Record<string, string> {
  return (activeEnvironment.value?.variables as Record<string, string>) ?? {}
}

const isJsonInvalid = ref(false)

function validateJson(value: string) {
  if (props.language !== 'json') {
    isJsonInvalid.value = false
    return
  }
  if (!value.trim()) {
    isJsonInvalid.value = false
    return
  }
  try {
    JSON.parse(value)
    isJsonInvalid.value = false
  }
  catch {
    isJsonInvalid.value = true
  }
}

function getLanguageExtension(): Extension {
  if (props.language === 'json')
    return json()
  return []
}

function createBodyEditorTheme() {
  return EditorView.theme({
    '&': {
      minHeight: '10rem',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)',
      fontSize: '12px',
      fontFamily: 'var(--font-mono)',
    },
    '.cm-content': {
      padding: '0.5rem',
      caretColor: 'var(--foreground)',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-gutters': {
      display: 'none',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--foreground)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-selectionBackground': {
      backgroundColor:
        'color-mix(in oklch, var(--primary) 24%, transparent) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor:
        'color-mix(in oklch, var(--primary) 24%, transparent) !important',
    },
    '.cm-placeholder': {
      color: 'var(--muted-foreground)',
    },
    ...notesEditorScrollbarTheme,
  })
}

function createEditorState(doc: string): EditorState {
  const extensions: Extension[] = [
    createBodyEditorTheme(),
    EditorView.lineWrapping,
    history(),
    indentUnit.of('  '),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    placeholder(props.placeholder ?? ''),
    languageCompartment.of(getLanguageExtension()),
    varInterpolationExtension({ getVariables }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || isApplyingExternalValue)
        return
      model.value = update.state.doc.toString()
    }),
    EditorView.domEventHandlers({
      blur() {
        validateJson(view?.state.doc.toString() ?? '')
        return false
      },
    }),
  ]

  return EditorState.create({ doc, extensions })
}

watch(model, (value) => {
  if (!view)
    return
  const current = view.state.doc.toString()
  if (current === value)
    return
  isApplyingExternalValue = true
  view.dispatch({
    changes: { from: 0, to: current.length, insert: value ?? '' },
  })
  isApplyingExternalValue = false
})

watch(
  () => props.language,
  () => {
    if (!view)
      return
    view.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtension()),
    })
    if (props.language !== 'json')
      isJsonInvalid.value = false
  },
)

watch(
  () => activeEnvironment.value?.variables,
  () => {
    if (view)
      refreshVariables(view)
  },
  { deep: true },
)

onMounted(() => {
  if (!editorContainer.value)
    return
  view = new EditorView({
    state: createEditorState(model.value),
    parent: editorContainer.value,
  })
})

onUnmounted(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      class="bg-background overflow-hidden rounded-md border"
      :class="isJsonInvalid ? 'border-red-500' : 'border-input'"
    >
      <div
        ref="editorContainer"
        class="cursor-text"
      />
    </div>
    <div
      v-if="isJsonInvalid"
      class="text-xs text-red-500"
    >
      {{ i18n.t("spaces.http.editor.body.jsonInvalid") }}
    </div>
  </div>
</template>
