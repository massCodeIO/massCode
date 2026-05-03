<script setup lang="ts">
import type { Extension } from '@codemirror/state'
import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import { editorScrollbarTheme } from '@/components/cm-extensions/scrollbarTheme'
import { useTheme } from '@/composables'
import { json } from '@codemirror/lang-json'
import { StreamLanguage } from '@codemirror/language'
import { http } from '@codemirror/legacy-modes/mode/http'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'

type CodeViewerLanguage = 'plain' | 'json' | 'http' | 'shell'

const props = withDefaults(
  defineProps<{
    content: string
    language?: CodeViewerLanguage
    wrapLines?: boolean
  }>(),
  {
    wrapLines: true,
  },
)

const { '.cm-scroller': editorScrollerTheme, ...editorScrollbarRestTheme }
  = editorScrollbarTheme

const { isDark } = useTheme()
const editorContainer = ref<HTMLElement>()

let view: EditorView | null = null

function createViewerTheme(wrapLines: boolean) {
  return EditorView.theme({
    '&': {
      height: '100%',
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
      caretColor: 'transparent',
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
    '.cm-selectionBackground': {
      backgroundColor:
        'color-mix(in oklch, var(--primary) 24%, transparent) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor:
        'color-mix(in oklch, var(--primary) 24%, transparent) !important',
    },
    ...editorScrollbarRestTheme,
  })
}

function createEditorState(doc: string): EditorState {
  const extensions: Extension[] = [
    createViewerTheme(props.wrapLines),
    lineNumbers(),
    highlightActiveLineGutter(),
    drawSelection(),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    keymap.of([]),
    createCodeHighlight(isDark.value),
  ]

  if (props.wrapLines) {
    extensions.push(EditorView.lineWrapping)
  }

  if (props.language === 'json') {
    extensions.push(json())
  }
  else if (props.language === 'http') {
    extensions.push(StreamLanguage.define(http))
  }
  else if (props.language === 'shell') {
    extensions.push(StreamLanguage.define(shell))
  }

  return EditorState.create({ doc, extensions })
}

watch(
  () => [props.content, props.language, props.wrapLines, isDark.value] as const,
  ([content]) => {
    if (!view)
      return

    view.setState(createEditorState(content))
  },
)

onMounted(() => {
  if (!editorContainer.value)
    return

  view = new EditorView({
    state: createEditorState(props.content),
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
    class="h-full min-h-0"
  />
</template>
