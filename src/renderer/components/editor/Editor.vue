<script setup lang="ts">
import type { Language } from '@/components/editor/types'
import {
  useApp,
  useDonations,
  useEditor,
  useResizeHandle,
  useSnippets,
  useSnippetUpdate,
  useTheme,
} from '@/composables'
import { i18n, ipc } from '@/electron'
import { getContentSearchMatches } from '@/utils/contentSearch'
import {
  mapNormalizedCursorIndex,
  normalizeTerminalText,
} from '@/utils/normalizeTerminalText'
import {
  useClipboard,
  useCssVar,
  useDebounceFn,
  useEventListener,
} from '@vueuse/core'
import CodeMirror from 'codemirror'
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/matchbrackets'
import 'codemirror/addon/selection/active-line'
import 'codemirror/addon/scroll/simplescrollbars'
import 'codemirror/addon/scroll/simplescrollbars.css'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

const { settings, cursorPosition } = useEditor()
const {
  displayedSnippet,
  displayedSnippetContent,
  selectedSnippetContent,
  selectedSnippet,
  isEmpty,
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
const { editorThemeName } = useTheme()

const {
  addToUpdateContentQueue,
  getPendingContentUpdate,
  isContentUpdateBusy,
} = useSnippetUpdate()

let editor: CodeMirror.Editor | null = null
let currentSearchOverlay: any = null
let currentSearchMarker: CodeMirror.TextMarker | null = null
// id фрагмента, чьё тело сейчас отображается в редакторе: пока полная запись
// сниппета загружается, selectedSnippetContent содержит только метаданные.
let lastAppliedContentId: number | undefined
let contentApplyRevision = 0
let contentSearchRevision = 0
let contentSearchScrollFrame: number | undefined
let contentSearchFocusRevision = 0
let isContentSearchFocusPending = false

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
    editor?.refresh()
  },
})

const isProgrammaticChange = ref(false)

useCssVar('--editor-font-size', document.body, {
  initialValue: `${settings.fontSize}px`,
})

useCssVar('--editor-font-family', document.body, {
  initialValue: settings.fontFamily,
})

const scrollBarOpacity = useCssVar(
  '--editor-scrollbar-opacity',
  document.body,
  {
    initialValue: '1',
  },
)

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
    && selectedSnippet.value?.id === state.snippetId
    && selectedSnippetContent.value?.value !== undefined,
)
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
  const { line, ch } = editor.getCursor()
  cursorPosition.row = line
  cursorPosition.column = ch
}

const hideScrollbar = useDebounceFn(() => {
  scrollBarOpacity.value = '0'
}, 1000)

async function init() {
  const el = document.getElementById('editor')

  if (!el)
    return

  editor = CodeMirror(el, {
    value: displayedSnippetContent.value?.value || ' ',
    mode: displayedSnippetContent.value?.language || 'plain_text',
    theme: editorThemeName.value,
    lineWrapping: settings.wrap,
    lineNumbers: true,
    tabSize: settings.tabSize,
    indentUnit: settings.tabSize,
    indentWithTabs: true,
    autoCloseBrackets: true,
    matchBrackets: settings.matchBrackets,
    styleActiveLine: settings.highlightLine,
    scrollbarStyle: 'null',
  })

  if (displayedSnippetContent.value?.value !== undefined) {
    lastAppliedContentId = displayedSnippetContent.value.id
  }

  editor.on('change', (e) => {
    if (
      isProgrammaticChange.value
      || !selectedSnippet.value?.id
      || !isSelectedSnippetContentReady.value
    ) {
      return
    }

    const content = selectedSnippetContent.value
    // Сохраняем только когда тело загружено и редактор отображает именно
    // этот фрагмент — иначе в момент переключения можно перезаписать
    // сниппет чужим текстом.
    if (
      !content
      || content.value === undefined
      || content.id !== lastAppliedContentId
    ) {
      return
    }

    const updatedValue = e.getValue()

    if (content.value !== updatedValue) {
      addToUpdateContentQueue(selectedSnippet.value.id, content.id, {
        label: content.label,
        value: updatedValue,
        language: content.language,
      })
    }

    refreshContentSearch(false)
  })

  editor.on('cursorActivity', getCursorPosition)

  editor.on('scroll', () => {
    scrollBarOpacity.value = '1'
    editor?.setOption('scrollbarStyle', 'overlay')
  })

  editor.on('scroll', hideScrollbar)

  editor.on('drop', async (cm, e) => {
    if (
      isSelectedSnippetContentReady.value
      && displayedSnippetContent.value?.language === 'markdown'
    ) {
      const file = e.dataTransfer?.files[0]

      if (!file)
        return

      if (!file.type.startsWith('image/'))
        return

      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Array.from(new Uint8Array(arrayBuffer))

        // Вызываем IPC хендлер для сохранения файла из буфера
        const relativePath = await ipc.invoke('fs:assets', {
          buffer,
          fileName: file.name,
        })

        cm.replaceSelection(`![${file.name}](./${relativePath})`)
      }
      catch (error) {
        console.error('Ошибка при добавлении изображения:', error)
      }
    }
  })

  ipc.on('main-menu:copy-snippet', onCopySnippetMenu)
  ipc.on('main-menu:find', onFindMenu)

  watch(displayedSnippetContent, (v) => {
    const revision = ++contentApplyRevision
    const scheduledSnippetId = displayedSnippet.value?.id
    const scheduledContentId = v?.id

    nextTick(() => {
      if (
        revision !== contentApplyRevision
        || displayedSnippet.value?.id !== scheduledSnippetId
        || displayedSnippetContent.value?.id !== scheduledContentId
      ) {
        return
      }

      // Полная запись выбранного сниппета ещё загружается — не очищаем
      // редактор промежуточным состоянием (метаданные без value).
      if (displayedSnippet.value && (!v || v.value === undefined)) {
        return
      }

      // Сравниваем с последним реально отображённым фрагментом, а не с
      // предыдущим значением computed: между сниппетами проскакивает
      // metadata-only состояние с тем же id.
      const isNewValue = v?.id !== lastAppliedContentId
      const isSameContent = v?.id === lastAppliedContentId
      const snippetId = displayedSnippet.value?.id
      const contentId = v?.id
      let nextValue = v?.value || ''

      if (snippetId && contentId) {
        const pendingUpdate = getPendingContentUpdate(snippetId, contentId)
        if (pendingUpdate) {
          nextValue = pendingUpdate.value || ''
        }

        if (
          isSameContent
          && isContentUpdateBusy(snippetId, contentId)
          && editor
          && editor.getValue() !== nextValue
        ) {
          return
        }
      }

      // Не сохраняем вьюпорт при смене фрагмента/сниппета
      setValue(nextValue, true, !isNewValue)
      lastAppliedContentId = contentId
      if (contentSearchQuery.value)
        refreshContentSearch()
      focusPendingContentSearch()
    })
  })

  watch(displayedSnippetContent, (v) => {
    if (v)
      setLanguage(v.language as Language)
  })

  watch(editorThemeName, (themeName) => {
    editor?.setOption('theme', themeName)
  })

  watch(
    () => settings.fontSize,
    () => {
      nextTick(() => {
        editor?.refresh()
      })
    },
  )

  watch(
    () => settings.tabSize,
    (tabSize) => {
      const normalizedTabSize = Math.max(1, Number(tabSize) || 1)

      editor?.setOption('tabSize', normalizedTabSize)
      editor?.setOption('indentUnit', normalizedTabSize)
    },
  )

  watch(
    isShowEditor,
    (isVisible, wasVisible) => {
      if (!isVisible || wasVisible !== false)
        return

      nextTick(() => {
        requestAnimationFrame(() => {
          editor?.refresh()
        })
      })
    },
    { flush: 'post' },
  )
}

function setValue(value: string, programmatic = true, preserveViewport = true) {
  if (!editor)
    return

  const current = editor.getValue()
  if (current === value)
    return

  const cursor = preserveViewport ? editor.getCursor() : null
  const { left, top } = preserveViewport
    ? editor.getScrollInfo()
    : { left: 0, top: 0 }

  isProgrammaticChange.value = programmatic
  editor.setValue(value)
  if (programmatic) {
    editor.clearHistory()
  }
  isProgrammaticChange.value = false

  if (preserveViewport) {
    if (cursor)
      editor.setCursor(cursor)
    editor.scrollTo(left, top)
  }
  else {
    editor.setCursor({ line: 0, ch: 0 })
    editor.scrollTo(0, 0)
    editor.refresh()
  }
}

function setLanguage(language: Language) {
  editor?.setOption('mode', language)
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
    editor.getValue(),
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
  const from = targetEditor.posFromIndex(match.from)
  const to = targetEditor.posFromIndex(match.to)

  contentSearchIndex.value = normalizedIndex
  currentSearchMarker?.clear()
  currentSearchMarker = editor.markText(from, to, {
    className: 'cm-content-search-current',
  })
  targetEditor.setSelection(from, to)
  if (contentSearchScrollFrame !== undefined)
    cancelAnimationFrame(contentSearchScrollFrame)
  contentSearchScrollFrame = requestAnimationFrame(() => {
    contentSearchScrollFrame = undefined
    if (
      editor === targetEditor
      && revision === contentSearchRevision
      && match.to <= targetEditor.getValue().length
    ) {
      targetEditor.scrollIntoView({ from, to }, 50)
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
  if (!isContentSearchFocusPending || isSelectedSnippetContentLoading.value)
    return

  const revision = contentSearchFocusRevision
  nextTick(() => {
    if (
      !isContentSearchOpen.value
      || revision !== contentSearchFocusRevision
      || isSelectedSnippetContentLoading.value
    ) {
      return
    }
    isContentSearchFocusPending = false
    editor?.refresh()
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

async function format() {
  if (!isSelectedSnippetContentReady.value)
    return

  const availableLang: Language[] = [
    'css',
    'dockerfile',
    'gitignore',
    'graphqlschema',
    'html',
    'ini',
    'jade',
    'java',
    'javascript',
    'json',
    'json5',
    'less',
    'markdown',
    'php',
    'properties',
    'sass',
    'scss',
    'sh',
    'toml',
    'typescript',
    'xml',
    'yaml',
  ]

  if (
    selectedSnippetContent.value?.value
    && !selectedSnippetContent.value?.language
  ) {
    return
  }

  if (
    !availableLang.includes(selectedSnippetContent.value?.language as Language)
  )
    return

  const lang = selectedSnippetContent.value?.language as Language
  const value = selectedSnippetContent.value?.value
  const snippetId = state.snippetId
  const contentId = selectedSnippetContent.value?.id
  let parser = lang as string

  const shellLike = ['dockerfile', 'gitignore', 'properties', 'ini']

  if (lang === 'javascript')
    parser = 'babel'
  if (lang === 'graphqlschema')
    parser = 'graphql'
  if (shellLike.includes(lang))
    parser = 'sh'

  try {
    const formatted = await ipc.invoke('prettier:format', {
      text: value,
      parser,
    })
    if (
      !isSelectedSnippetContentReady.value
      || state.snippetId !== snippetId
      || selectedSnippetContent.value?.id !== contentId
    ) {
      return
    }
    setValue(formatted, false)
  }
  catch (err) {
    console.error(err)
  }
}

function onCopySnippetMenu() {
  if (!isSelectedSnippetContentReady.value)
    return

  const { copy } = useClipboard({ source: editor?.getValue() || '' })
  copy()
  useDonations().incrementCopy('code')
}

function normalizeTerminalOutput() {
  if (!editor || !isSelectedSnippetContentReady.value)
    return

  if (editor.somethingSelected()) {
    const selections = editor.getSelections()
    const normalized = selections.map(normalizeTerminalText)

    if (normalized.some((value, index) => value !== selections[index]))
      editor.replaceSelections(normalized, 'around')

    return
  }

  const value = editor.getValue()
  const normalized = normalizeTerminalText(value)

  if (normalized === value)
    return

  const cursorIndex = editor.indexFromPos(editor.getCursor())
  const mappedIndex = mapNormalizedCursorIndex(value, cursorIndex, normalized)

  setValue(normalized, false)
  editor.setCursor(editor.posFromIndex(mappedIndex))
}

ipc.on('main-menu:format', format)
ipc.on('main-menu:normalize-code-line-breaks', normalizeTerminalOutput)

// Спейсы пересоздаются при переключении: без снятия listeners каждый цикл
// добавляет обработчик и удерживает мёртвый инстанс CodeMirror от GC.
// removeListeners по каналу, т.к. contextBridge оборачивает функцию в новый
// прокси и removeListener по ссылке не срабатывает; владелец каналов — только
// этот компонент.
onBeforeUnmount(() => {
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

function createSearchOverlay(query: string) {
  if (!query)
    return null

  let regexp: RegExp

  try {
    regexp = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  }
  catch {
    return null
  }

  return {
    token: (stream: any) => {
      regexp.lastIndex = stream.pos
      const match = regexp.exec(stream.string)
      if (match && match.index === stream.pos) {
        stream.pos += match[0].length
        return 'searching'
      }
      else if (match) {
        stream.pos = match.index
      }
      else {
        stream.skipToEnd()
      }
    },
  }
}

function updateSearchOverlay() {
  if (!editor)
    return

  if (currentSearchOverlay) {
    editor.removeOverlay(currentSearchOverlay)
    currentSearchOverlay = null
  }

  currentSearchMarker?.clear()
  currentSearchMarker = null

  const query = isContentSearchOpen.value
    ? contentSearchQuery.value
    : spaceSearchQuery.value

  if (query) {
    currentSearchOverlay = createSearchOverlay(query)
    if (currentSearchOverlay) {
      editor.addOverlay(currentSearchOverlay)
    }
  }

  if (
    isContentSearchOpen.value
    && contentSearchIndex.value >= 0
    && contentSearchMatches.value.length
  ) {
    const match = contentSearchMatches.value[contentSearchIndex.value]
    currentSearchMarker = editor.markText(
      editor.posFromIndex(match.from),
      editor.posFromIndex(match.to),
      { className: 'cm-content-search-current' },
    )
  }
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
@reference '../../styles.css';
.CodeMirror {
  font-size: var(--editor-font-size);
  font-family: var(--editor-font-family);
  line-height: calc(var(--editor-font-size) * 1.5);
  height: 100%;
  background-color: var(--background) !important;
}

.CodeMirror-gutters {
  background-color: var(--background) !important;
}

.CodeMirror-linenumber {
  color: var(--muted-foreground) !important;
}

.CodeMirror-cursor {
  border-left: 2px solid var(--foreground) !important;
  background-color: transparent !important;
}

.CodeMirror-selected {
  background-color: var(--accent) !important;
}

.CodeMirror-overlayscroll-vertical div {
  background-color: var(--scrollbar);
  width: 7px;
  opacity: var(--editor-scrollbar-opacity);
  transition: opacity 0.3s;
}

.CodeMirror-overlayscroll-horizontal div {
  background-color: var(--scrollbar);
  height: 7px;
  opacity: var(--editor-scrollbar-opacity);
  transition: opacity 0.3s;
}

.CodeMirror-scrollbar-filler {
  background-color: transparent;
}

.CodeMirror .cm-searching {
  background-color: var(--text-highlight);
  color: black !important;
  border-radius: 2px;
}

.CodeMirror .cm-content-search-current {
  outline: 1px solid var(--foreground);
  outline-offset: 1px;
}
</style>
