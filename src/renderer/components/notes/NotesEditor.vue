<script setup lang="ts">
import { useTheme } from '@/composables'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { hideMarkup } from './cm-extensions/hideMarkup'
import { markdownDecorations } from './cm-extensions/markdownDecorations'

const content = defineModel<string>('content', { default: '' })
const { isDark: _isDark } = useTheme()

const editorContainer = ref<HTMLElement>()
let view: EditorView | null = null
let isApplyingExternalContent = false

const lightTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-sans)',
    padding: '16px 24px',
    caretColor: 'var(--foreground)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--foreground)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--accent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--accent) !important',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-line': {
    padding: '0',
  },
})

function createEditorState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      lightTheme,
      EditorView.lineWrapping,
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
      markdownDecorations,
      hideMarkup,
      placeholder('Start typing...'),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !isApplyingExternalContent) {
          content.value = update.state.doc.toString()
        }
      }),
    ],
  })
}

watch(content, (val) => {
  if (!view)
    return

  const currentValue = view.state.doc.toString()
  if (currentValue === val)
    return

  isApplyingExternalContent = true
  view.setState(createEditorState(val))
  isApplyingExternalContent = false
})

onMounted(() => {
  if (!editorContainer.value)
    return

  view = new EditorView({
    state: createEditorState(content.value),
    parent: editorContainer.value,
  })
})

onUnmounted(() => {
  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div
    ref="editorContainer"
    class="h-full overflow-hidden"
  />
</template>
