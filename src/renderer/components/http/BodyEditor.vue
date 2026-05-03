<script setup lang="ts">
import type { Extension } from '@codemirror/state'
import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import { editorScrollbarTheme } from '@/components/cm-extensions/scrollbarTheme'
import { useHttpEnvironments, useTheme } from '@/composables'
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
import {
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view'
import {
  refreshVariables,
  varInterpolationExtension,
} from './cm-extensions/varInterpolation'

interface Props {
  language?: 'json' | 'text' | 'form-urlencoded'
  placeholder?: string
  wrapLines?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  language: 'text',
  wrapLines: true,
})

const { '.cm-scroller': editorScrollerTheme, ...editorScrollbarRestTheme }
  = editorScrollbarTheme

const model = defineModel<string>({ default: '' })
const editorContainer = ref<HTMLElement>()

const { activeEnvironment } = useHttpEnvironments()
const { isDark } = useTheme()

let view: EditorView | null = null
let isApplyingExternalValue = false
const languageCompartment = new Compartment()
const highlightCompartment = new Compartment()
const themeCompartment = new Compartment()
const wrapCompartment = new Compartment()

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

function createBodyEditorTheme(wrapLines: boolean) {
  return EditorView.theme({
    '&': {
      height: '100%',
      minHeight: '14rem',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)',
      fontSize: '12px',
      fontFamily: 'var(--font-mono)',
    },
    '.cm-scroller': {
      ...editorScrollerTheme,
      height: '100%',
    },
    '.cm-content': {
      ...(wrapLines
        ? {
            boxSizing: 'border-box',
            width: '100%',
          }
        : {
            minWidth: 'max-content',
          }),
      padding: '0.5rem 0.75rem',
      caretColor: 'var(--foreground)',
    },
    '.cm-line': {
      padding: '0',
      ...(wrapLines
        ? {
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }
        : {}),
    },
    '.cm-gutters': {
      borderRight: '1px solid var(--border)',
      backgroundColor: 'var(--background)',
      color: 'var(--muted-foreground)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '2rem',
      padding: '0 0.5rem',
      fontSize: '11px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
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
    ...editorScrollbarRestTheme,
  })
}

function createEditorState(doc: string): EditorState {
  const extensions: Extension[] = [
    themeCompartment.of(createBodyEditorTheme(props.wrapLines)),
    lineNumbers(),
    highlightActiveLineGutter(),
    wrapCompartment.of(props.wrapLines ? EditorView.lineWrapping : []),
    history(),
    indentUnit.of('  '),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    placeholder(props.placeholder ?? ''),
    languageCompartment.of(getLanguageExtension()),
    highlightCompartment.of(createCodeHighlight(isDark.value)),
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

watch(isDark, () => {
  if (!view)
    return
  view.dispatch({
    effects: highlightCompartment.reconfigure(
      createCodeHighlight(isDark.value),
    ),
  })
})

watch(
  () => props.wrapLines,
  () => {
    if (!view)
      return
    view.dispatch({
      effects: [
        themeCompartment.reconfigure(createBodyEditorTheme(props.wrapLines)),
        wrapCompartment.reconfigure(
          props.wrapLines ? EditorView.lineWrapping : [],
        ),
      ],
    })
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
  <div class="flex min-h-0 flex-col gap-1">
    <div
      class="bg-background min-h-0 flex-1 overflow-hidden rounded-md border"
      :class="isJsonInvalid ? 'border-red-500' : 'border-input'"
    >
      <div
        ref="editorContainer"
        class="h-full min-h-[14rem] cursor-text"
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
