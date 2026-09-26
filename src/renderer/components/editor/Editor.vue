<script setup lang="ts">
import type { EditSnapshot } from '@/composables/ai/edit'
import type { NativeBridgeResult } from '@/composables/ai/nativeBridges'
import type { Extension } from '@codemirror/state'
import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import {
  createContentSearch,
  setContentSearchMatches,
} from '@/components/cm-extensions/contentSearch'
import {
  useApp,
  useDonations,
  useEditor,
  useResizeHandle,
  useSnippets,
  useSnippetUpdate,
  useSonner,
  useTheme,
} from '@/composables'
import { matchesSnapshot } from '@/composables/ai/edit'
import { registerNativeBridge } from '@/composables/ai/nativeBridges'
import { useAi } from '@/composables/ai/useAi'
import { i18n, ipc, store } from '@/electron'
import { getContentSearchMatches } from '@/utils/contentSearch'
import {
  mapNormalizedCursorIndex,
  normalizeTerminalText,
} from '@/utils/normalizeTerminalText'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
} from '@codemirror/commands'
import { bracketMatching, indentUnit } from '@codemirror/language'
import {
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
} from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import {
  useClipboard,
  useCssVar,
  useDebounceFn,
  useEventListener,
  useResizeObserver,
} from '@vueuse/core'
import { getCodeFormatterParser } from '~/shared/codeFormatter'
import { loadLanguageSupport } from './grammars'

const { setContext: setAiContext, registerEditor: registerAiEditor } = useAi()
const { settings, cursorPosition } = useEditor()
const { sonner } = useSonner()
const {
  displayedSnippet,
  displayedSnippetContent,
  selectedSnippetContent,
  selectedSnippet,
  isEmpty: isSnippetListEmpty,
  isSearch,
  selectedSnippetIds,
  selectedSnippetRecordStatus,
  isAvailableToCodePreview,
  retrySelectedSnippet,
  searchQuery: spaceSearchQuery,
} = useSnippets()
const {
  isShowCodePreview,
  isShowCodeImage,
  isFocusedSearch,
  isShowJsonVisualizer,
  state,
} = useApp()
const { editorThemeName, isDark } = useTheme()

const {
  addToUpdateContentQueue,
  getPendingContentUpdate,
  isContentUpdateBusy,
  flushSnippetContent,
} = useSnippetUpdate()

let editor: EditorView | null = null
const languageCompartment = new Compartment()
const settingsCompartment = new Compartment()
const themeCompartment = new Compartment()
let appliedLanguage: string | undefined
let appliedLanguageSupport: Extension = []
let isUnmounted = false
const isApplyingContent = ref(false)
function editorSettings() {
  return [
    settings.wrap ? EditorView.lineWrapping : [],
    settings.matchBrackets ? bracketMatching() : [],
    settings.highlightLine ? highlightActiveLine() : [],
    EditorState.tabSize.of(Math.max(1, Number(settings.tabSize) || 1)),
    indentUnit.of('\t'),
  ]
}
function editorTheme() {
  return [
    createCodeHighlight(isDark.value),
    EditorView.editorAttributes.of({
      class: editorThemeName.value
        .split(/\s+/)
        .map(name => `cm-s-${name}`)
        .join(' '),
    }),
  ]
}
function createState(doc: string, support: Extension) {
  return EditorState.create({
    doc,
    extensions: [
      history(),
      EditorState.allowMultipleSelections.of(true),
      lineNumbers(),
      drawSelection(),
      closeBrackets(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      languageCompartment.of(support),
      EditorState.changeFilter.of(canChangeContent),
      settingsCompartment.of(editorSettings()),
      themeCompartment.of(editorTheme()),
      createContentSearch(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          saveEditorContent()
          queueMicrotask(() => {
            if (editor === update.view)
              refreshContentSearch(false)
          })
        }
        if (update.docChanged || update.selectionSet) {
          getCursorPosition()
          updateAiContext()
        }
      }),
      EditorView.domEventHandlers({
        scroll: onEditorScroll,
        drop(event) {
          return onImageDrop(event)
        },
      }),
    ],
  })
}
// id фрагмента, чьё тело сейчас отображается в редакторе: пока полная запись
// сниппета загружается, selectedSnippetContent содержит только метаданные.
let lastAppliedContentId: number | undefined
let contentApplyRevision = 0
let contentSearchRevision = 0
let contentSearchScrollFrame: number | undefined
let contentSearchFocusRevision = 0
let isContentSearchFocusPending = false

const editorMountRef = useTemplateRef('editorMountRef')
useResizeObserver(editorMountRef, () => editor?.requestMeasure())
const previewHandleRef = ref<HTMLElement>()
const contentSearchPanelRef = useTemplateRef('contentSearchPanelRef')
const isContentSearchOpen = ref(false)
const contentSearchQuery = ref('')
const contentSearchMatches = ref<{ from: number, to: number }[]>([])
const contentSearchIndex = ref(-1)
const previewHeight = ref(300)

useResizeHandle(previewHandleRef, {
  direction: 'vertical',
  onMove(dy) {
    previewHeight.value = Math.max(100, previewHeight.value - dy)
    editor?.requestMeasure()
  },
})

const isProgrammaticChange = ref(false)

const fontSize = useCssVar('--editor-font-size', document.body, {
  initialValue: `${settings.fontSize}px`,
})

const fontFamily = useCssVar('--editor-font-family', document.body, {
  initialValue: settings.fontFamily,
})

const scrollBarOpacity = useCssVar(
  '--editor-scrollbar-opacity',
  document.body,
  {
    initialValue: '1',
  },
)

// Переименование может убрать последнее совпадение, но не должно закрывать редактор.
const isEmpty = computed(() => isSnippetListEmpty.value && !isSearch.value)

const isShowHeader = computed(() => {
  if (selectedSnippetIds.value.length > 1)
    return false
  return !isEmpty.value && selectedSnippet.value !== undefined
})
const isShowEditor = computed(() => {
  if (selectedSnippetIds.value.length > 1)
    return false
  return (
    !isShowCodeImage.value
    && !isShowJsonVisualizer.value
    && !isEmpty.value
    && selectedSnippet.value !== undefined
  )
})
const isSelectedSnippetContentLoading = computed(
  () => selectedSnippetRecordStatus.value === 'loading',
)
const isSelectedSnippetContentReady = computed(
  () =>
    selectedSnippetRecordStatus.value === 'ready'
    && !isApplyingContent.value
    && selectedSnippetContent.value?.id === lastAppliedContentId
    && selectedSnippet.value?.id === state.snippetId
    && selectedSnippetContent.value?.value !== undefined,
)
const unregisterAiWorkspace = useAi().registerWorkspace(() => ({
  space: 'code',
  selectedIds: [...selectedSnippetIds.value],
  folderId: state.folderId ?? null,
  library: state.libraryFilter,
}))
onBeforeUnmount(unregisterAiWorkspace)
function readAiContext() {
  const content = selectedSnippetContent.value
  const snippet = selectedSnippet.value
  if (
    !editor
    || !content
    || !snippet
    || !isSelectedSnippetContentReady.value
    || selectedSnippetIds.value.length !== 1
    || content.id !== lastAppliedContentId
  ) {
    return undefined
  }
  return {
    space: 'code' as const,
    snippetId: snippet.id,
    name: snippet.name,
    contentId: content.id,
    text: editor.state.doc.toString(),
    selection: editor.state.sliceDoc(
      editor.state.selection.main.from,
      editor.state.selection.main.to,
    ),
    selectionFrom:
      editor.state.selection.ranges.length === 1
        ? editor.state.selection.main.from
        : undefined,
    selectionTo:
      editor.state.selection.ranges.length === 1
        ? editor.state.selection.main.to
        : undefined,
    language: content.language || 'plain_text',
  }
}
async function applyAiEdit(snapshot: EditSnapshot, replacement: string) {
  if (
    !editor
    || !matchesSnapshot(
      snapshot,
      readAiContext(),
      store.preferences.get<string>('storage.vaultPath') ?? '',
    )
  ) {
    return false
  }
  editor.dispatch({
    changes: { from: snapshot.from, to: snapshot.to, insert: replacement },
    annotations: isolateHistory.of('full'),
  })
  if (snapshot.space !== 'code')
    return false
  await nextTick()
  await flushSnippetContent(snapshot.snippetId, snapshot.contentId)
  return true
}

function updateAiContext() {
  setAiContext(readAiContext())
}
watch(
  [isSelectedSnippetContentReady, selectedSnippetContent, selectedSnippetIds],
  () => {
    updateAiContext()
    focusPendingContentSearch()
  },
  { flush: 'sync' },
)
let unregisterAiEditor: (() => void) | undefined

const isSelectedSnippetLoadingVisible = ref(false)
let selectedSnippetLoadingTimer: ReturnType<typeof setTimeout> | undefined

watch(
  selectedSnippetRecordStatus,
  (status) => {
    if (selectedSnippetLoadingTimer)
      clearTimeout(selectedSnippetLoadingTimer)
    selectedSnippetLoadingTimer = undefined
    isSelectedSnippetLoadingVisible.value = false

    if (status === 'loading') {
      selectedSnippetLoadingTimer = setTimeout(() => {
        if (selectedSnippetRecordStatus.value === 'loading')
          isSelectedSnippetLoadingVisible.value = true
      }, 300)
    }
  },
  { immediate: true },
)

watch(
  () => state.snippetId,
  () => {
    contentSearchFocusRevision += 1
    isContentSearchFocusPending = false
  },
)

watch(displayedSnippetContent, () => {
  if (displayedSnippetContent.value?.language !== 'json') {
    isShowJsonVisualizer.value = false
  }

  if (!isAvailableToCodePreview.value) {
    isShowCodePreview.value = false
  }
})

function getCursorPosition() {
  if (!editor)
    return
  const position = editor.state.selection.main.head
  const line = editor.state.doc.lineAt(position)
  cursorPosition.row = line.number - 1
  cursorPosition.column = position - line.from
}

const hideScrollbar = useDebounceFn(() => {
  scrollBarOpacity.value = '0'
}, 1000)

function onEditorScroll() {
  scrollBarOpacity.value = '1'
  hideScrollbar()
}

async function init() {
  const el = document.getElementById('editor')

  if (!el)
    return

  unregisterAiEditor = registerAiEditor(readAiContext, applyAiEdit)
  ipc.on('main-menu:copy-snippet', onCopySnippetMenu)
  ipc.on('main-menu:find', onFindMenu)

  watch(
    displayedSnippetContent,
    () => {
      void applyDisplayedContent()
    },
    { flush: 'sync' },
  )

  watch([editorThemeName, isDark], () => {
    editor?.dispatch({ effects: themeCompartment.reconfigure(editorTheme()) })
  })
  watch(
    () => [
      settings.tabSize,
      settings.wrap,
      settings.matchBrackets,
      settings.highlightLine,
    ],
    () => {
      editor?.dispatch({
        effects: settingsCompartment.reconfigure(editorSettings()),
      })
    },
  )
  watch(
    () => [settings.fontSize, settings.fontFamily],
    () => {
      fontSize.value = `${settings.fontSize}px`
      fontFamily.value = settings.fontFamily
      editor?.requestMeasure()
    },
  )

  watch(
    isShowEditor,
    (isVisible, wasVisible) => {
      if (!isVisible || wasVisible !== false)
        return

      nextTick(() => {
        requestAnimationFrame(() => {
          editor?.requestMeasure()
        })
      })
    },
    { flush: 'post' },
  )
  await applyDisplayedContent()
}

async function applyDisplayedContent() {
  const revision = ++contentApplyRevision
  const content = displayedSnippetContent.value
  const snippetId = displayedSnippet.value?.id
  const contentId = content?.id
  const languageId = content?.language ?? 'plain_text'
  const isSameContent = !!editor && contentId === lastAppliedContentId
  const previousDocument = editor?.state.doc.toString()
  isApplyingContent.value = !isSameContent

  // Keep the previous highlighted document while the selected record loads.
  if (
    displayedSnippet.value
    && (content?.value === undefined || snippetId !== state.snippetId)
  ) {
    return
  }

  let support = appliedLanguageSupport
  let languageLoaded = true
  if (languageId !== appliedLanguage) {
    try {
      support = (await loadLanguageSupport(languageId)) ?? []
    }
    catch (error) {
      console.error(error)
      support = []
      languageLoaded = false
    }
  }
  if (
    isUnmounted
    || revision !== contentApplyRevision
    || (snippetId !== undefined && snippetId !== state.snippetId)
    || snippetId !== displayedSnippet.value?.id
    || contentId !== displayedSnippetContent.value?.id
    || languageId !== (displayedSnippetContent.value?.language ?? 'plain_text')
  ) {
    return
  }

  let nextValue = content?.value ?? ''
  if (snippetId && contentId) {
    const pendingUpdate = getPendingContentUpdate(snippetId, contentId)
    if (pendingUpdate)
      nextValue = pendingUpdate.value ?? ''
    if (
      isSameContent
      && editor
      && (isContentUpdateBusy(snippetId, contentId)
        || editor.state.doc.toString() !== previousDocument)
    ) {
      nextValue = editor.state.doc.toString()
    }
  }

  if (!editor) {
    const parent = document.getElementById('editor')
    if (!parent)
      return
    editor = new EditorView({ parent, state: createState(nextValue, support) })
  }
  else {
    // A new fragment gets fresh history. Same-fragment updates retain selection
    // and history, and install the new language in the document transaction.
    setValue(nextValue, true, isSameContent, support)
  }
  lastAppliedContentId = contentId
  appliedLanguage = languageLoaded ? languageId : undefined
  appliedLanguageSupport = support
  isApplyingContent.value = false
  getCursorPosition()
  updateAiContext()
  if (contentSearchQuery.value)
    refreshContentSearch()
  focusPendingContentSearch()
}

function canChangeContent() {
  return isProgrammaticChange.value || isSelectedSnippetContentReady.value
}

function saveEditorContent() {
  if (
    !editor
    || isProgrammaticChange.value
    || !selectedSnippet.value?.id
    || !isSelectedSnippetContentReady.value
  ) {
    return
  }
  const content = selectedSnippetContent.value
  if (
    !content
    || content.value === undefined
    || content.id !== lastAppliedContentId
  ) {
    return
  }
  const value = editor.state.doc.toString()
  if (content.value !== value) {
    addToUpdateContentQueue(selectedSnippet.value.id, content.id, {
      label: content.label,
      value,
      language: content.language,
    })
  }
}
function onImageDrop(event: DragEvent) {
  const file = event.dataTransfer?.files[0]
  if (
    !editor
    || !isSelectedSnippetContentReady.value
    || displayedSnippetContent.value?.language !== 'markdown'
    || !file?.type.startsWith('image/')
  ) {
    return false
  }
  event.preventDefault()
  const contentId = lastAppliedContentId
  const snippetId = state.snippetId
  const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
  const current = () =>
    editor
    && isSelectedSnippetContentReady.value
    && contentId === lastAppliedContentId
    && snippetId === state.snippetId
    && vault === (store.preferences.get<string>('storage.vaultPath') ?? '')
  void (async () => {
    const buffer = Array.from(new Uint8Array(await file.arrayBuffer()))
    if (!current())
      return
    const path = await ipc.invoke('fs:assets', { buffer, fileName: file.name })
    if (current()) {
      editor!.dispatch(
        editor!.state.replaceSelection(`![${file.name}](./${path})`),
      )
    }
  })().catch(console.error)
  return true
}
function setValue(
  value: string,
  programmatic = true,
  preserveViewport = true,
  support?: Extension,
) {
  if (!editor)
    return
  const { scrollLeft, scrollTop } = editor.scrollDOM
  isProgrammaticChange.value = programmatic
  try {
    if (!preserveViewport) {
      editor.setState(createState(value, support ?? appliedLanguageSupport))
      getCursorPosition()
      editor.scrollDOM.scrollTo(0, 0)
    }
    else if (editor.state.doc.toString() !== value || support !== undefined) {
      const selection = EditorSelection.create(
        editor.state.selection.ranges.map(range =>
          EditorSelection.range(
            Math.min(range.anchor, value.length),
            Math.min(range.head, value.length),
          ),
        ),
      )
      editor.dispatch({
        changes:
          editor.state.doc.toString() !== value
            ? { from: 0, to: editor.state.doc.length, insert: value }
            : undefined,
        effects:
          support === undefined ? [] : languageCompartment.reconfigure(support),
        selection,
        annotations: programmatic
          ? Transaction.addToHistory.of(false)
          : isolateHistory.of('full'),
      })
      editor.scrollDOM.scrollTo(scrollLeft, scrollTop)
    }
  }
  finally {
    isProgrammaticChange.value = false
  }
}

function focusEditor() {
  isShowCodeImage.value = false
  isShowJsonVisualizer.value = false

  nextTick(() => {
    requestAnimationFrame(() => {
      editor?.focus()
    })
  })
}

function refreshContentSearch(selectFirst = true) {
  if (!editor)
    return

  contentSearchRevision += 1
  contentSearchMatches.value = getContentSearchMatches(
    editor.state.doc.toString(),
    contentSearchQuery.value,
  )

  if (!contentSearchMatches.value.length) {
    contentSearchIndex.value = -1
  }
  else if (selectFirst || contentSearchIndex.value < 0) {
    contentSearchIndex.value = 0
  }
  else {
    contentSearchIndex.value = Math.min(
      contentSearchIndex.value,
      contentSearchMatches.value.length - 1,
    )
  }

  updateSearchOverlay()

  if (selectFirst && contentSearchIndex.value >= 0)
    selectContentSearchMatch(contentSearchIndex.value)
}

function selectContentSearchMatch(index: number) {
  if (!editor || !contentSearchMatches.value.length)
    return

  const normalizedIndex
    = (index + contentSearchMatches.value.length)
      % contentSearchMatches.value.length
  const match = contentSearchMatches.value[normalizedIndex]
  const targetEditor = editor
  const revision = ++contentSearchRevision
  contentSearchIndex.value = normalizedIndex
  updateSearchOverlay()
  targetEditor.dispatch({ selection: { anchor: match.from, head: match.to } })
  if (contentSearchScrollFrame !== undefined)
    cancelAnimationFrame(contentSearchScrollFrame)
  contentSearchScrollFrame = requestAnimationFrame(() => {
    contentSearchScrollFrame = undefined
    if (
      editor === targetEditor
      && revision === contentSearchRevision
      && match.to <= targetEditor.state.doc.length
    ) {
      targetEditor.dispatch({
        effects: EditorView.scrollIntoView(match.from, {
          y: 'center',
          yMargin: 50,
        }),
      })
    }
  })
}

function openContentSearch() {
  isShowCodeImage.value = false
  isShowJsonVisualizer.value = false
  isContentSearchOpen.value = true
  isContentSearchFocusPending = true
  updateSearchOverlay()
  contentSearchFocusRevision += 1
  focusPendingContentSearch()
}

function focusPendingContentSearch() {
  if (!isContentSearchFocusPending || !isSelectedSnippetContentReady.value)
    return

  const revision = contentSearchFocusRevision
  nextTick(() => {
    if (
      !isContentSearchFocusPending
      || !isContentSearchOpen.value
      || revision !== contentSearchFocusRevision
      || !isSelectedSnippetContentReady.value
    ) {
      return
    }
    isContentSearchFocusPending = false
    editor?.requestMeasure()
    contentSearchPanelRef.value?.focusInput()
  })
}

function closeContentSearch(focus = true) {
  contentSearchRevision += 1
  contentSearchFocusRevision += 1
  isContentSearchFocusPending = false
  isContentSearchOpen.value = false
  contentSearchQuery.value = ''
  updateSearchOverlay()
  if (focus)
    focusEditor()
}

function onContentSearchKeydown(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f')
    return

  if (
    !event.shiftKey
    && (isEmpty.value
      || !selectedSnippet.value
      || selectedSnippetIds.value.length > 1)
  ) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (event.shiftKey) {
    closeContentSearch(false)
    isFocusedSearch.value = true
    return
  }

  openContentSearch()
}

function onFindMenu() {
  if (
    isEmpty.value
    || !selectedSnippet.value
    || selectedSnippetIds.value.length > 1
  ) {
    return
  }

  openContentSearch()
}

useEventListener(window, 'keydown', onContentSearchKeydown, { capture: true })

watch(contentSearchQuery, () => refreshContentSearch())
watch(spaceSearchQuery, () => {
  if (!isContentSearchOpen.value) {
    nextTick(() => {
      if (!isContentSearchOpen.value)
        updateSearchOverlay()
    })
  }
})

async function formatCurrent(
  current: () => boolean = () => true,
): Promise<NativeBridgeResult | undefined> {
  if (!isSelectedSnippetContentReady.value)
    return

  const lang = selectedSnippetContent.value?.language
  const parser = getCodeFormatterParser(lang)
  if (!parser)
    return { status: 'unavailable' }
  const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
  const before = readAiContext()
  const value = before?.text
  if (!before)
    return
  let mutation: NativeBridgeResult['mutation']
  const snippetId = state.snippetId
  const contentId = selectedSnippetContent.value?.id
  try {
    const formatted = await ipc.invoke('prettier:format', {
      text: value,
      parser,
    })
    if (
      !current()
      || !isSelectedSnippetContentReady.value
      || editor?.state.doc.toString() !== value
      || state.snippetId !== snippetId
      || selectedSnippetContent.value?.id !== contentId
      || selectedSnippetContent.value?.language !== lang
      || (store.preferences.get<string>('storage.vaultPath') ?? '') !== vault
    ) {
      return
    }
    if (
      typeof formatted !== 'string'
      || snippetId === undefined
      || contentId === undefined
    ) {
      return { status: 'failed' }
    }
    setValue(formatted, false)
    if (before.text && before.text !== formatted) {
      const contextId = crypto.randomUUID()
      mutation = {
        kind: 'editor',
        snapshot: {
          ...before,
          contextId,
          from: 0,
          to: before.text.length,
          vault,
        },
        calls: [
          {
            id: contextId,
            type: 'function',
            function: {
              name: 'propose_edit',
              arguments: JSON.stringify({
                context_id: contextId,
                summary: 'Native formatting',
                edits: [{ old_text: before.text, new_text: formatted }],
              }),
            },
          },
        ],
      }
    }
    await nextTick()
    await flushSnippetContent(snippetId, contentId)
    return { status: 'done', persisted: true, mutation }
  }
  catch (err) {
    console.error(err)
    return { status: 'failed', mutation }
  }
}
async function format() {
  const result = await formatCurrent()
  if (result?.status === 'failed')
    sonner({ type: 'error', message: i18n.t('messages:error.formatFailed') })
  return result
}
let unregisterNativeEditor: (() => void) | undefined
onMounted(() => {
  unregisterNativeEditor = registerNativeBridge(
    'codeEditor',
    async (action, current) => {
      if (!current() || !readAiContext())
        return { status: 'stale' }
      if (action.action === 'format') {
        const result = await formatCurrent(current)
        return result ?? { status: 'unavailable' }
      }
      if (action.action === 'findInContent') {
        if (!action.command || action.command === 'search') {
          if (!action.query)
            return { status: 'unavailable' }
          openContentSearch()
          contentSearchQuery.value = action.query
          await nextTick()
          refreshContentSearch()
        }
        else if (action.command === 'close') {
          closeContentSearch(false)
        }
        else {
          if (!isContentSearchOpen.value)
            return { status: 'unavailable' }
          selectContentSearchMatch(
            contentSearchIndex.value + (action.command === 'next' ? 1 : -1),
          )
        }
        return {
          status: current() ? 'done' : 'stale',
          search: {
            open: isContentSearchOpen.value,
            index: isContentSearchOpen.value ? contentSearchIndex.value : -1,
            count: isContentSearchOpen.value
              ? contentSearchMatches.value.length
              : 0,
          },
        }
      }
      return { status: 'unavailable' }
    },
  )
})
onBeforeUnmount(() => unregisterNativeEditor?.())

function onCopySnippetMenu() {
  if (!isSelectedSnippetContentReady.value)
    return

  const { copy } = useClipboard({ source: editor?.state.doc.toString() || '' })
  copy()
  useDonations().incrementCopy('code')
}

function normalizeTerminalOutput() {
  if (!editor || !isSelectedSnippetContentReady.value)
    return

  if (editor.state.selection.ranges.some(range => !range.empty)) {
    editor.dispatch(
      editor.state.changeByRange((range) => {
        const value = normalizeTerminalText(
          editor!.state.sliceDoc(range.from, range.to),
        )
        return {
          changes: { from: range.from, to: range.to, insert: value },
          range: EditorSelection.range(range.from, range.from + value.length),
        }
      }),
    )
    return
  }

  const value = editor.state.doc.toString()
  const normalized = normalizeTerminalText(value)

  if (normalized === value)
    return

  const cursorIndex = editor.state.selection.main.head
  const mappedIndex = mapNormalizedCursorIndex(value, cursorIndex, normalized)

  setValue(normalized, false)
  editor.dispatch({ selection: { anchor: mappedIndex } })
}

ipc.on('main-menu:format', format)
ipc.on('main-menu:normalize-code-line-breaks', normalizeTerminalOutput)

// Спейсы пересоздаются при переключении: без снятия listeners каждый цикл
// добавляет обработчик и удерживает мёртвый инстанс CodeMirror от GC.
// removeListeners по каналу, т.к. contextBridge оборачивает функцию в новый
// прокси и removeListener по ссылке не срабатывает; владелец каналов — только
// этот компонент.
onBeforeUnmount(() => {
  isUnmounted = true
  contentApplyRevision++
  editor?.destroy()
  editor = null
  unregisterAiEditor?.()
  contentSearchRevision += 1
  if (contentSearchScrollFrame !== undefined)
    cancelAnimationFrame(contentSearchScrollFrame)
  if (selectedSnippetLoadingTimer)
    clearTimeout(selectedSnippetLoadingTimer)
  ipc.removeListeners('main-menu:format')
  ipc.removeListeners('main-menu:normalize-code-line-breaks')
  ipc.removeListeners('main-menu:copy-snippet')
  ipc.removeListeners('main-menu:find')
})

function updateSearchOverlay() {
  if (!editor)
    return
  const query = isContentSearchOpen.value
    ? contentSearchQuery.value
    : spaceSearchQuery.value
  editor.dispatch({
    effects: setContentSearchMatches.of({
      matches: getContentSearchMatches(editor.state.doc.toString(), query),
      currentIndex: isContentSearchOpen.value ? contentSearchIndex.value : -1,
    }),
  })
}

onMounted(() => {
  init()
})
</script>

<template>
  <div
    data-editor
    class="relative grid h-full grid-rows-[auto_1fr_auto] overflow-hidden pt-[var(--content-top-offset)]"
  >
    <UiLoadingOverlay
      v-if="isSelectedSnippetContentLoading"
      :silent="!isSelectedSnippetLoadingVisible"
    />
    <UiLoadingOverlay
      v-else-if="selectedSnippetRecordStatus === 'error'"
      error
      :label="i18n.t('contentLoad.failed')"
      :action-label="i18n.t('contentLoad.retry')"
      @retry="retrySelectedSnippet"
    />
    <UiLoadingOverlay
      v-else-if="selectedSnippet?.pendingCloudDownload"
      :label="i18n.t('cloudDownloads.itemPending')"
    />
    <EditorHeader
      v-if="isShowHeader"
      :inert="!isSelectedSnippetContentReady"
      @focus-editor="focusEditor"
    />
    <div
      v-show="isShowEditor"
      :inert="!isSelectedSnippetContentReady"
      class="flex min-h-0 flex-1 flex-col overflow-auto"
    >
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ContentSearchPanel
          v-if="isContentSearchOpen"
          ref="contentSearchPanelRef"
          v-model="contentSearchQuery"
          :count="contentSearchMatches.length"
          :current-index="contentSearchIndex"
          @close="closeContentSearch"
          @next="selectContentSearchMatch(contentSearchIndex + 1)"
          @previous="selectContentSearchMatch(contentSearchIndex - 1)"
        />
        <div
          id="editor"
          ref="editorMountRef"
          data-editor-mount
          class="min-h-0 flex-1"
        />
      </div>
      <template v-if="isShowCodePreview">
        <div
          ref="previewHandleRef"
          class="before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 flex h-px shrink-0 cursor-row-resize items-center justify-center bg-transparent before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:transition-[background-color,height] before:duration-150 before:content-[''] after:absolute after:inset-x-0 after:top-1/2 after:h-3 after:-translate-y-1/2 after:content-[''] hover:before:h-0.5 hover:before:delay-200 data-[resizing]:before:h-0.5"
        />
        <div
          :style="{ height: `${previewHeight}px` }"
          class="shrink-0 overflow-hidden"
        >
          <EditorPreview />
        </div>
      </template>
    </div>
    <EditorFooter
      v-if="isShowEditor"
      :inert="!isSelectedSnippetContentReady"
    />
    <EditorCodeImage v-if="isShowCodeImage" />
    <EditorJsonVisualizer v-if="isShowJsonVisualizer" />
    <div
      v-if="
        isEmpty
          || selectedSnippetIds.length > 1
          || selectedSnippet === undefined
      "
      class="row-span-full flex items-center justify-center"
    >
      <UiEmptyPlaceholder
        v-if="isEmpty || selectedSnippet === undefined"
        :text="i18n.t('snippet.noSelected')"
      />
      <UiEmptyPlaceholder
        v-if="!isEmpty && selectedSnippetIds.length > 1"
        :text="
          i18n.t('snippet.selectedMultiple', {
            count: selectedSnippetIds.length,
          })
        "
      />
    </div>
  </div>
</template>

<style>
#editor .cm-editor {
  height: 100%;
  background: var(--background);
  color: var(--foreground);
  font-size: var(--editor-font-size);
}
#editor .cm-scroller {
  overflow: auto;
  font-family: var(--editor-font-family);
  line-height: 1.5;
  scrollbar-color: var(--scrollbar) transparent;
}
#editor .cm-gutters {
  background: var(--background);
  color: var(--muted-foreground);
  border: none;
}
#editor .cm-cursor {
  border-left: 2px solid var(--foreground);
}
#editor .cm-selectionBackground,
#editor .cm-focused .cm-selectionBackground {
  background: var(--accent) !important;
}
#editor .cm-activeLine {
  background: var(--muted);
}
#editor .cm-focused {
  outline: none;
}
</style>
