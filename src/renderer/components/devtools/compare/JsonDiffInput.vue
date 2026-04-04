<script setup lang="ts">
import { notesEditorScrollbarTheme } from '@/components/notes/cm-extensions/scrollbarTheme'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { indentUnit } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'

interface Props {
  placeholder?: string
  error?: string
  scrollTop?: number
  scrollLeft?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  paste: []
  blur: []
  scroll: [position: { top: number, left: number }]
}>()

const model = defineModel<string>({ default: '' })
const editorContainer = ref<HTMLElement>()

let view: EditorView | null = null
let isApplyingExternalValue = false
let isApplyingSyncedScroll = false

function createJsonDiffTheme() {
  return EditorView.theme({
    '&': {
      minHeight: '10rem',
      maxHeight: '14rem',
      borderRadius: 'calc(var(--radius) - 2px)',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)',
      fontSize: 'var(--json-diff-font-size)',
      fontFamily: 'var(--json-diff-font-family)',
    },
    '.cm-scroller': {
      minHeight: '10rem',
      maxHeight: '14rem',
    },
    '.cm-content': {
      padding: '0.75rem',
      caretColor: 'var(--foreground)',
      lineHeight: 'var(--json-diff-line-height)',
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
    createJsonDiffTheme(),
    EditorView.lineWrapping,
    history(),
    indentUnit.of('  '),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    placeholder(props.placeholder ?? ''),
    json(),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || isApplyingExternalValue)
        return

      model.value = update.state.doc.toString()
    }),
    EditorView.domEventHandlers({
      blur() {
        emit('blur')
        return false
      },
      paste() {
        requestAnimationFrame(() => {
          emit('paste')
        })
        return false
      },
    }),
  ]

  return EditorState.create({
    doc,
    extensions,
  })
}

function handleScroll() {
  if (!view || isApplyingSyncedScroll)
    return

  emit('scroll', {
    top: view.scrollDOM.scrollTop,
    left: view.scrollDOM.scrollLeft,
  })
}

function applyScrollPosition() {
  if (!view)
    return

  const nextTop = props.scrollTop ?? 0
  const nextLeft = props.scrollLeft ?? 0

  if (
    view.scrollDOM.scrollTop === nextTop
    && view.scrollDOM.scrollLeft === nextLeft
  ) {
    return
  }

  isApplyingSyncedScroll = true
  view.scrollDOM.scrollTop = nextTop
  view.scrollDOM.scrollLeft = nextLeft

  requestAnimationFrame(() => {
    isApplyingSyncedScroll = false
  })
}

watch(model, (value) => {
  if (!view)
    return

  const current = view.state.doc.toString()
  if (current === value)
    return

  isApplyingExternalValue = true
  view.setState(createEditorState(value))
  isApplyingExternalValue = false
})

watch(
  () => props.placeholder,
  () => {
    if (!view)
      return

    isApplyingExternalValue = true
    view.setState(createEditorState(model.value))
    isApplyingExternalValue = false
  },
)

watch(
  () => [props.scrollTop, props.scrollLeft],
  () => {
    applyScrollPosition()
  },
)

onMounted(() => {
  if (!editorContainer.value)
    return

  view = new EditorView({
    state: createEditorState(model.value),
    parent: editorContainer.value,
  })

  view.scrollDOM.addEventListener('scroll', handleScroll)
  applyScrollPosition()
})

onUnmounted(() => {
  view?.scrollDOM.removeEventListener('scroll', handleScroll)
  view?.destroy()
  view = null
})
</script>

<template>
  <div class="space-y-1.5">
    <div
      class="bg-background cursor-text overflow-hidden rounded-lg border"
      :class="props.error ? 'border-red-500' : 'border-input'"
      style="min-height: 10rem; max-height: 14rem"
    >
      <div
        ref="editorContainer"
        class="cursor-text overflow-hidden"
        style="min-height: 10rem; max-height: 14rem"
      />
    </div>
    <div
      v-if="props.error"
      class="text-sm text-red-500"
    >
      {{ props.error }}
    </div>
  </div>
</template>
