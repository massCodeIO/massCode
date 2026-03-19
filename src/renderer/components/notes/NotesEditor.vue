<script setup lang="ts">
import { useTheme } from '@/composables'
import { ipc } from '@/electron'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  type KeyBinding,
  keymap,
  placeholder,
} from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { createCodeHighlight } from './cm-extensions/codeHighlight'
import { createHideMarkup } from './cm-extensions/hideMarkup'
import { listIndent } from './cm-extensions/listIndent'
import { createMarkdownDecorations } from './cm-extensions/markdownDecorations'
import { createMermaidBlocks } from './cm-extensions/mermaidBlocks'
import { moveSelectionToAdjacentMermaidSource } from './cm-extensions/mermaidNavigation'
import { notesEditorScrollbarTheme } from './cm-extensions/scrollbarTheme'
import { createTableBlocks } from './cm-extensions/tableBlocks'
import { moveSelectionToAdjacentTableSource } from './cm-extensions/tableNavigation'

interface Props {
  mode?: 'edit' | 'presentation'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'edit',
})
const content = defineModel<string>('content', { default: '' })
const { isDark } = useTheme()
const isPresentationMode = computed(() => props.mode === 'presentation')

const editorContainer = ref<HTMLElement>()
let view: EditorView | null = null
let isApplyingExternalContent = false

const markdownLinkRegExp = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const autolinkRegExp = /<(https?:\/\/[^>\s]+|masscode:\/\/[^>\s]+)>/g
const plainUrlRegExp = /(https?:\/\/[^\s)]+)/g

function extractUrlAtOffset(lineText: string, offset: number): string | null {
  for (const pattern of [markdownLinkRegExp, autolinkRegExp, plainUrlRegExp]) {
    pattern.lastIndex = 0
    let match = pattern.exec(lineText)

    while (match) {
      const from = match.index
      const to = from + match[0].length
      if (offset >= from && offset <= to) {
        return match[1] ?? match[0]
      }

      match = pattern.exec(lineText)
    }
  }

  return null
}

function createLinkClickHandler() {
  return EditorView.domEventHandlers({
    click(event, view) {
      const target = event.target
      if (!(target instanceof HTMLElement))
        return false

      const pos = view.posAtCoords({
        x: event.clientX,
        y: event.clientY,
      })
      if (pos === null)
        return false

      const line = view.state.doc.lineAt(pos)
      const url = extractUrlAtOffset(line.text, pos - line.from)
      if (!url)
        return false

      if (
        !url.startsWith('http://')
        && !url.startsWith('https://')
        && !url.startsWith('masscode://')
      ) {
        return false
      }

      event.preventDefault()
      void ipc.invoke('system:open-external', url)
      return true
    },
  })
}

const mermaidNavigationKeymap: KeyBinding[] = [
  {
    key: 'ArrowDown',
    run: view =>
      moveSelectionToAdjacentMermaidSource(view, 'down')
      || moveSelectionToAdjacentTableSource(view, 'down'),
  },
  {
    key: 'ArrowUp',
    run: view =>
      moveSelectionToAdjacentMermaidSource(view, 'up')
      || moveSelectionToAdjacentTableSource(view, 'up'),
  },
]

const editTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-sans)',
    padding: '10px 20px 28px',
    lineHeight: '1.54',
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
  ...notesEditorScrollbarTheme,
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-line': {
    padding: '0',
  },
})

const presentationTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-sans)',
    padding: '22px 28px 34px',
    fontSize: 'calc(1rem * var(--markdown-scale))',
    lineHeight: '1.58',
    maxWidth: '980px',
    margin: '0 auto',
  },
  '.cm-gutters': {
    display: 'none',
  },
  ...notesEditorScrollbarTheme,
  '.cm-line': {
    padding: '0',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'transparent !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'transparent !important',
  },
  '.cm-cursor, .cm-dropCursor': {
    display: 'none',
  },
})

function createEditorState(doc: string): EditorState {
  const extensions: Extension[] = [
    isPresentationMode.value ? presentationTheme : editTheme,
    EditorView.lineWrapping,
    history(),
    keymap.of([
      ...(isPresentationMode.value ? [] : mermaidNavigationKeymap),
      ...(isPresentationMode.value ? [] : listIndent),
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: GFM,
    }),
    createMermaidBlocks({
      enabled: true,
      isDark: isDark.value,
      showSourceWhenSelectionInside: !isPresentationMode.value,
    }),
    createTableBlocks({
      enabled: true,
      showSourceWhenSelectionInside: !isPresentationMode.value,
    }),
    createCodeHighlight(isDark.value),
    createMarkdownDecorations({
      interactiveTaskMarkers: !isPresentationMode.value,
      calloutTitleMode: isPresentationMode.value ? 'replace' : 'smart',
    }),
    createHideMarkup({ alwaysHide: isPresentationMode.value }),
  ]

  if (isPresentationMode.value) {
    extensions.push(
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      createLinkClickHandler(),
    )
  }
  else {
    extensions.push(placeholder('Start typing...'))
  }

  extensions.push(
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !isApplyingExternalContent) {
        content.value = update.state.doc.toString()
      }
    }),
  )

  return EditorState.create({
    doc,
    extensions,
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

watch(isPresentationMode, () => {
  if (!view)
    return

  isApplyingExternalContent = true
  view.setState(createEditorState(content.value))
  isApplyingExternalContent = false
})

watch(isDark, () => {
  if (!view)
    return

  isApplyingExternalContent = true
  view.setState(createEditorState(content.value))
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
