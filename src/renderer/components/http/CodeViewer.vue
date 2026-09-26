<script setup lang="ts">
import type { Extension } from '@codemirror/state'
import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import { editorScrollbarTheme } from '@/components/cm-extensions/scrollbarTheme'
import { loadLanguageSupport } from '@/components/editor/grammars'
import { useTheme } from '@/composables'
import { Compartment, EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'

type CodeViewerLanguage = string

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
const languageCompartment = new Compartment()

let languageRevision = 0
async function loadLanguage() {
  const revision = ++languageRevision
  try {
    const support = await loadLanguageSupport(props.language)
    if (view && revision === languageRevision) {
      view.dispatch({
        effects: languageCompartment.reconfigure(support ?? []),
      })
    }
  }
  catch {
    /* Keep plain text when a language chunk is unavailable. */
  }
}

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
    languageCompartment.of([]),
    createCodeHighlight(isDark.value),
  ]

  if (props.wrapLines) {
    extensions.push(EditorView.lineWrapping)
  }

  return EditorState.create({ doc, extensions })
}

watch(
  () => [props.content, props.language, props.wrapLines, isDark.value] as const,
  ([content]) => {
    if (!view)
      return

    view.setState(createEditorState(content))
    void loadLanguage()
  },
)

onMounted(() => {
  if (!editorContainer.value)
    return

  view = new EditorView({
    state: createEditorState(props.content),
    parent: editorContainer.value,
  })
  void loadLanguage()
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
