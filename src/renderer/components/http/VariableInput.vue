<script setup lang="ts">
import { useHttpEnvironments } from '@/composables'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as placeholderExt,
} from '@codemirror/view'
import {
  refreshVariables,
  varInterpolationExtension,
} from './cm-extensions/varInterpolation'

interface Props {
  placeholder?: string
}

const props = defineProps<Props>()

const model = defineModel<string>({ default: '' })

const { activeEnvironment } = useHttpEnvironments()

const editorContainer = ref<HTMLElement>()
let view: EditorView | null = null
let isApplyingExternalValue = false

function getVariables(): Record<string, string> {
  return (activeEnvironment.value?.variables as Record<string, string>) ?? {}
}

function createTheme() {
  return EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      fontSize: '14px',
      width: '100%',
    },
    '.cm-scroller': {
      overflowY: 'hidden',
      lineHeight: '1.5',
    },
    '.cm-content': {
      padding: '0 0.5rem',
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
  })
}

const singleLineFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged)
    return tr
  const next = tr.newDoc.toString()
  if (!next.includes('\n'))
    return tr
  return []
})

function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      createTheme(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      placeholderExt(props.placeholder ?? ''),
      singleLineFilter,
      varInterpolationExtension({ getVariables }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || isApplyingExternalValue)
          return
        model.value = update.state.doc.toString()
      }),
    ],
  })
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
    state: createState(model.value),
    parent: editorContainer.value,
  })
})

onUnmounted(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div
    ref="editorContainer"
    class="border-border focus-within:border-primary flex h-7 w-full cursor-text items-center rounded-md border bg-[color-mix(in_oklch,var(--foreground)_2%,var(--background))]"
  />
</template>
