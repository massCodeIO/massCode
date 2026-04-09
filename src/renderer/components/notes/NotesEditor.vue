<script setup lang="ts">
import type { NotesEditorMode } from '@/composables/spaces/notes/useNotesApp'
import {
  applyPendingNavigationUIStateForNote,
  registerNavigationNoteUIState,
  useNotesEditor,
  useTheme,
} from '@/composables'
import { ipc } from '@/electron'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  type KeyBinding,
  keymap,
  lineNumbers as lineNumbersExtension,
  placeholder,
} from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { createCodeHighlight } from './cm-extensions/codeHighlight'
import { editorFocusExtension } from './cm-extensions/editorFocus'
import { createHideMarkup } from './cm-extensions/hideMarkup'
import {
  createImageBlocks,
  getImageBlockRanges,
} from './cm-extensions/imageBlocks'
import { createImageInsert } from './cm-extensions/imageInsert'
import { createInternalLinks } from './cm-extensions/internalLinks'
import { listIndent } from './cm-extensions/listIndent'
import { createMarkdownDecorations } from './cm-extensions/markdownDecorations'
import { createMermaidBlocks } from './cm-extensions/mermaidBlocks'
import { moveSelectionToAdjacentMermaidSource } from './cm-extensions/mermaidNavigation'
import { notesEditorScrollbarTheme } from './cm-extensions/scrollbarTheme'
import { createTableBlocks } from './cm-extensions/tableBlocks'
import { moveSelectionToAdjacentTableSource } from './cm-extensions/tableNavigation'
import { createNotesEditTheme } from './theme'

interface Props {
  mode?: NotesEditorMode
  noteId?: number
  presentation?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'livePreview',
  presentation: false,
})
const content = defineModel<string>('content', { default: '' })
const { isDark } = useTheme()
const { settings: notesSettings } = useNotesEditor()
const isRawMode = computed(() => props.mode === 'raw')
const isPreviewMode = computed(() => props.mode === 'preview')

const editorContainer = ref<HTMLElement>()
let view: EditorView | null = null
let isApplyingExternalContent = false
let unregisterNavigationNoteUIState: (() => void) | undefined

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

function moveSelectionToAdjacentImageSource(
  view: EditorView,
  direction: 'up' | 'down',
): boolean {
  if (view.state.selection.ranges.length !== 1)
    return false

  const head = view.state.selection.main.head
  const currentLineNumber = view.state.doc.lineAt(head).number
  const blocks = getImageBlockRanges(view.state)

  if (direction === 'down') {
    for (const block of blocks) {
      const blockLineNumber = view.state.doc.lineAt(block.from).number
      if (blockLineNumber <= currentLineNumber)
        continue
      if (blockLineNumber !== currentLineNumber + 1)
        return false

      const currentCol = head - view.state.doc.lineAt(head).from
      const targetLine = view.state.doc.line(blockLineNumber)
      const clampedCol = Math.min(currentCol, targetLine.length)
      view.dispatch({
        selection: { anchor: targetLine.from + clampedCol },
        scrollIntoView: true,
      })
      return true
    }
    return false
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    const blockLineNumber = view.state.doc.lineAt(block.from).number
    if (blockLineNumber >= currentLineNumber)
      continue
    if (blockLineNumber !== currentLineNumber - 1)
      return false

    const currentCol = head - view.state.doc.lineAt(head).from
    const targetLine = view.state.doc.line(blockLineNumber)
    const clampedCol = Math.min(currentCol, targetLine.length)
    view.dispatch({
      selection: { anchor: targetLine.from + clampedCol },
      scrollIntoView: true,
    })
    return true
  }

  return false
}

const navigationKeymap: KeyBinding[] = [
  {
    key: 'ArrowDown',
    run: view =>
      moveSelectionToAdjacentMermaidSource(view, 'down')
      || moveSelectionToAdjacentTableSource(view, 'down')
      || moveSelectionToAdjacentImageSource(view, 'down'),
  },
  {
    key: 'ArrowUp',
    run: view =>
      moveSelectionToAdjacentMermaidSource(view, 'up')
      || moveSelectionToAdjacentTableSource(view, 'up')
      || moveSelectionToAdjacentImageSource(view, 'up'),
  },
]

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
  const raw = isRawMode.value
  const preview = isPreviewMode.value
  const editable = !preview

  const extensions: Extension[] = [
    props.presentation
      ? presentationTheme
      : createNotesEditTheme(raw, notesSettings),
    EditorView.lineWrapping,
    history(),
    keymap.of([
      ...(editable && !raw ? navigationKeymap : []),
      ...(editable && !raw ? listIndent : []),
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    editorFocusExtension,
    indentUnit.of(' '.repeat(notesSettings.indentSize)),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: GFM,
    }),
    createCodeHighlight(isDark.value),
  ]

  if (notesSettings.lineNumbers && raw) {
    extensions.push(lineNumbersExtension())
  }

  if (!raw) {
    extensions.push(
      createMermaidBlocks({
        enabled: true,
        isDark: isDark.value,
        showSourceWhenSelectionInside: editable,
      }),
      createTableBlocks({
        enabled: true,
        showSourceWhenSelectionInside: editable,
      }),
      createImageBlocks({
        enabled: true,
        showSourceWhenSelectionInside: editable,
      }),
      createMarkdownDecorations({
        interactiveTaskMarkers: editable,
        calloutTitleMode: preview ? 'replace' : 'smart',
      }),
      createHideMarkup({ alwaysHide: preview }),
    )
  }

  extensions.push(
    ...createInternalLinks({
      editable,
      mode: props.mode,
    }),
  )

  if (preview) {
    extensions.push(
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      createLinkClickHandler(),
    )

    if (!props.presentation) {
      extensions.push(
        EditorView.theme({
          '.cm-cursor, .cm-dropCursor': { display: 'none' },
          '.cm-selectionBackground': {
            backgroundColor: 'transparent !important',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: 'transparent !important',
          },
        }),
      )
    }
  }
  else {
    extensions.push(placeholder('Start typing...'))
    extensions.push(createImageInsert())
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

watch(
  () => props.mode,
  () => {
    if (!view)
      return

    isApplyingExternalContent = true
    view.setState(createEditorState(content.value))
    isApplyingExternalContent = false
  },
)

watch(notesSettings, () => {
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

async function syncNavigationNoteUIStateRegistration(noteId = props.noteId) {
  unregisterNavigationNoteUIState?.()
  unregisterNavigationNoteUIState = undefined

  if (!view || noteId === undefined) {
    return
  }

  unregisterNavigationNoteUIState = registerNavigationNoteUIState(noteId, {
    getScrollTop: () => view?.scrollDOM.scrollTop ?? 0,
    setScrollTop: (scrollTop) => {
      view?.scrollDOM.scrollTo({ top: scrollTop })
    },
  })

  await nextTick()
  applyPendingNavigationUIStateForNote(noteId)
}

watch(
  () => props.noteId,
  noteId => syncNavigationNoteUIStateRegistration(noteId),
)

onMounted(() => {
  if (!editorContainer.value)
    return

  view = new EditorView({
    state: createEditorState(content.value),
    parent: editorContainer.value,
  })

  void syncNavigationNoteUIStateRegistration()
})

onUnmounted(() => {
  unregisterNavigationNoteUIState?.()
  unregisterNavigationNoteUIState = undefined

  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div class="h-full overflow-hidden">
    <div
      ref="editorContainer"
      class="h-full overflow-hidden"
    />
    <NotesInternalLinksOverlay />
  </div>
</template>
