<script setup lang="ts">
import type { NotesEditorMode } from '@/composables/spaces/notes/useNotesApp'
import type { EditorMenuCommand } from './NotesEditorContextMenu.vue'
import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import { editorScrollbarTheme } from '@/components/cm-extensions/scrollbarTheme'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  applyPendingNavigationUIStateForNote,
  registerNavigationNoteUIState,
  useCopyToClipboard,
  useNotesEditor,
  useTheme,
} from '@/composables'
import { i18n, ipc } from '@/electron'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState, type Extension, Prec } from '@codemirror/state'
import {
  EditorView,
  type KeyBinding,
  keymap,
  lineNumbers as lineNumbersExtension,
  placeholder,
} from '@codemirror/view'
import { GFM, type MarkdownConfig } from '@lezer/markdown'
import {
  clearInlineFormatting,
  getHeadingLevel,
  insertCallout,
  insertCodeBlock,
  insertHorizontalRule,
  insertLink,
  insertTable,
  normalizeLineBreaks,
  setBody,
  setHeading,
  toggleBold,
  toggleBulletList,
  toggleHighlight,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  toggleQuote,
  toggleStrikethrough,
  toggleTaskList,
} from './cm-extensions/editorCommands'
import { editorFocusExtension } from './cm-extensions/editorFocus'
import { createExternalLinksNavigation } from './cm-extensions/externalLinks'
import { fencedCodePairInput } from './cm-extensions/fencedCodeInput'
import { createHideMarkup } from './cm-extensions/hideMarkup'
import {
  createImageBlocks,
  getImageBlockRanges,
} from './cm-extensions/imageBlocks'
import { createImageInsert } from './cm-extensions/imageInsert'
import { createInternalLinks } from './cm-extensions/internalLinks'
import { createListIndent } from './cm-extensions/listIndent'
import { createListLineIndent } from './cm-extensions/listLineIndent'
import { createMarkdownDecorations } from './cm-extensions/markdownDecorations'
import { Highlight } from './cm-extensions/markdownHighlight'
import { markdownShortcuts } from './cm-extensions/markdownShortcuts'
import { createMermaidBlocks } from './cm-extensions/mermaidBlocks'
import { moveSelectionToAdjacentMermaidSource } from './cm-extensions/mermaidNavigation'
import { revealSelectionFreeze } from './cm-extensions/revealSelection'
import {
  createTableBlocks,
  getActiveTableCellContext,
  getActiveTableCellEditor,
  requestTableCellFocus,
  runActiveTableCellCommand,
  type TableCellMenuCommand,
  type TableCellMenuContext,
} from './cm-extensions/tableBlocks'
import { moveSelectionToAdjacentTableCell } from './cm-extensions/tableNavigation'
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
const copyToClipboard = useCopyToClipboard()
const isRawMode = computed(() => props.mode === 'raw')
const isPreviewMode = computed(() => props.mode === 'preview')

const editorContainer = ref<HTMLElement>()
let view: EditorView | null = null
let isApplyingExternalContent = false
let unregisterNavigationNoteUIState: (() => void) | undefined
// Последняя строка, отправленная редактором в модель: позволяет пропускать
// echo-обновления без материализации всего документа на каждый keystroke.
let lastEmittedContent: string | null = null
let lastAppliedNoteId: number | undefined

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
      || moveSelectionToAdjacentTableCell(view, 'down')
      || moveSelectionToAdjacentImageSource(view, 'down'),
  },
  {
    key: 'ArrowUp',
    run: view =>
      moveSelectionToAdjacentMermaidSource(view, 'up')
      || moveSelectionToAdjacentTableCell(view, 'up')
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
    // Широкий блок-виджет не должен распирать контент и давать редактору
    // горизонтальную прокрутку (см. minWidth в createNotesEditThemeStyles).
    minWidth: '0',
  },
  '.cm-gutters': {
    display: 'none',
  },
  ...editorScrollbarTheme,
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

const NoSetextHeading: MarkdownConfig = {
  remove: ['SetextHeading'],
}

function createEditorState(doc: string): EditorState {
  const raw = isRawMode.value
  const preview = isPreviewMode.value
  const editable = !preview
  const notesIndentUnit = ' '.repeat(Math.max(1, notesSettings.indentSize))

  const extensions: Extension[] = [
    props.presentation
      ? presentationTheme
      : createNotesEditTheme(raw, notesSettings),
    EditorView.lineWrapping,
    history(),
    Prec.highest(
      keymap.of(editable ? createListIndent({ indent: notesIndentUnit }) : []),
    ),
    keymap.of([
      ...(editable ? markdownShortcuts : []),
      ...(editable && !raw ? navigationKeymap : []),
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    editorFocusExtension,
    indentUnit.of(notesIndentUnit),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: [GFM, Highlight, NoSetextHeading],
    }),
    createCodeHighlight(isDark.value),
  ]

  if (notesSettings.lineNumbers && raw) {
    extensions.push(lineNumbersExtension())
  }

  if (editable && !raw) {
    extensions.push(fencedCodePairInput)
  }

  if (!raw) {
    extensions.push(
      revealSelectionFreeze,
      createMermaidBlocks({
        enabled: true,
        isDark: isDark.value,
        showSourceWhenSelectionInside: editable,
      }),
      createTableBlocks({
        enabled: true,
        editable,
        isDark: isDark.value,
      }),
      createImageBlocks({
        enabled: true,
        isDark: isDark.value,
        showSourceWhenSelectionInside: editable,
      }),
      createMarkdownDecorations({
        interactiveTaskMarkers: editable,
        calloutTitleMode: preview ? 'replace' : 'smart',
        codeBlockCopy: {
          label: i18n.t('button.copy'),
          copy: copyToClipboard,
        },
      }),
      createHideMarkup({ alwaysHide: preview }),
      createListLineIndent({ interactiveTaskMarkers: editable }),
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

  if (!raw) {
    extensions.push(createExternalLinksNavigation())
  }

  extensions.push(
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !isApplyingExternalContent) {
        lastEmittedContent = update.state.doc.toString()
        content.value = lastEmittedContent
      }
    }),
  )

  return EditorState.create({
    doc,
    extensions,
  })
}

function applyExternalState(doc: string) {
  if (!view)
    return

  isApplyingExternalContent = true
  view.setState(createEditorState(doc))
  isApplyingExternalContent = false
}

// noteId и content меняются согласованно (NotesEditorPane обновляет их
// вместе, когда контент заметки загружен), поэтому один watcher.
watch([() => props.noteId, content], ([noteId, val]) => {
  if (!view)
    return

  // Смена заметки: пересоздание EditorState сбрасывает undo-историю,
  // но переиспользует EditorView и DOM (раньше компонент пересоздавался
  // целиком через :key).
  if (noteId !== lastAppliedNoteId) {
    lastAppliedNoteId = noteId
    applyExternalState(val)
    return
  }

  // Echo собственного ввода: материализовать документ не нужно.
  if (val === lastEmittedContent)
    return

  const currentValue = view.state.doc.toString()
  if (currentValue === val)
    return

  // Внешнее обновление той же заметки: dispatch вместо пересоздания
  // состояния — сохраняет undo-историю, selection и расширения.
  isApplyingExternalContent = true
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: val },
  })
  isApplyingExternalContent = false
})

watch(
  () => props.mode,
  () => {
    applyExternalState(content.value)
  },
)

watch(notesSettings, () => {
  applyExternalState(content.value)
})

watch(isDark, () => {
  applyExternalState(content.value)
})

function focusEditor() {
  nextTick(() => {
    view?.focus()
  })
}

defineExpose({
  focusEditor,
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

// Контекст контекстного меню форматирования, снимается на правый клик.
const menuHasSelection = ref(false)
const menuHeadingLevel = ref(0)
const menuTable = shallowRef<TableCellMenuContext | null>(null)
let pendingInsertedTableStart: number | null = null

function onEditorContextMenu() {
  if (!view)
    return

  // Правый клик в ячейке таблицы: меню работает с вложенным редактором.
  const cellEditor = getActiveTableCellEditor()
  const target = cellEditor ?? view

  menuHasSelection.value = !target.state.selection.main.empty
  menuHeadingLevel.value = cellEditor ? 0 : getHeadingLevel(view)
  menuTable.value = getActiveTableCellContext()
}

function onContextMenuCloseAutoFocus(event: Event) {
  // Фокус должен вернуться во вложенный редактор ячейки (а не на контейнер):
  // после команды он уже там, а при закрытии меню без команды возвращаем сами.
  const cellEditor = getActiveTableCellEditor()
  if (cellEditor) {
    event.preventDefault()
    cellEditor.focus()
    return
  }

  if (pendingInsertedTableStart === null || !view)
    return

  event.preventDefault()
  requestTableCellFocus(view, {
    tableFrom: pendingInsertedTableStart,
    selector: 'thead th:first-child',
    mode: 'select',
  })
  pendingInsertedTableStart = null
}

function onMenuCommand(command: EditorMenuCommand) {
  if (!view)
    return

  if (command.startsWith('table-')) {
    runActiveTableCellCommand(command as TableCellMenuCommand)
    return
  }

  // Внутри ячейки таблицы inline-команды идут во вложенный редактор, а
  // блочные (заголовки, списки, вставка) не имеют смысла — игнорируем.
  const cellEditor = getActiveTableCellEditor()
  const inlineTarget = cellEditor ?? view
  const isInlineCommand = [
    'bold',
    'italic',
    'strikethrough',
    'highlight',
    'code',
    'link',
    'clear-formatting',
  ].includes(command)

  if (cellEditor && !isInlineCommand)
    return

  if (command.startsWith('heading-')) {
    setHeading(view, Number(command.slice('heading-'.length)))
    return
  }

  switch (command) {
    case 'bold':
      toggleBold(inlineTarget)
      break
    case 'italic':
      toggleItalic(inlineTarget)
      break
    case 'strikethrough':
      toggleStrikethrough(inlineTarget)
      break
    case 'highlight':
      toggleHighlight(inlineTarget)
      break
    case 'code':
      toggleInlineCode(inlineTarget)
      break
    case 'link':
      insertLink(inlineTarget)
      break
    case 'clear-formatting':
      clearInlineFormatting(inlineTarget)
      break
    case 'bullet-list':
      toggleBulletList(view)
      break
    case 'numbered-list':
      toggleOrderedList(view)
      break
    case 'task-list':
      toggleTaskList(view)
      break
    case 'body':
      setBody(view)
      break
    case 'quote':
      toggleQuote(view)
      break
    case 'table':
      pendingInsertedTableStart = insertTable(view)
      break
    case 'callout':
      insertCallout(view)
      break
    case 'horizontal-rule':
      insertHorizontalRule(view)
      break
    case 'code-block':
      insertCodeBlock(view)
      break
  }
}

function onNormalizeLineBreaks() {
  if (!view || isPreviewMode.value)
    return

  normalizeLineBreaks(view)
}

ipc.on('main-menu:normalize-note-line-breaks', onNormalizeLineBreaks)

onMounted(() => {
  if (!editorContainer.value)
    return

  view = new EditorView({
    state: createEditorState(content.value),
    parent: editorContainer.value,
  })
  lastAppliedNoteId = props.noteId

  void syncNavigationNoteUIStateRegistration()
})

onUnmounted(() => {
  unregisterNavigationNoteUIState?.()
  unregisterNavigationNoteUIState = undefined
  ipc.removeListeners('main-menu:normalize-note-line-breaks')

  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div class="h-full overflow-hidden">
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger
        as-child
        :disabled="isPreviewMode"
      >
        <div
          ref="editorContainer"
          class="h-full overflow-hidden"
          @contextmenu="onEditorContextMenu"
        />
      </ContextMenu.ContextMenuTrigger>
      <NotesEditorContextMenu
        :has-selection="menuHasSelection"
        :heading-level="menuHeadingLevel"
        :table="menuTable"
        @close-auto-focus="onContextMenuCloseAutoFocus"
        @command="onMenuCommand"
      />
    </ContextMenu.ContextMenu>
    <NotesInternalLinksOverlay />
  </div>
</template>
