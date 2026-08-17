<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import {
  useDonations,
  useEditableField,
  useNavigationHistory,
  useNotes,
  useNotesApp,
  useNoteUpdate,
} from '@/composables'
import { i18n, ipc } from '@/electron'
import { navigateBack, navigateForward } from '@/ipc/listeners/deepLinks'
import { router, RouterName } from '@/router'
import { getEntryNameConflictMessage } from '@/utils'
import { useClipboard, useDebounceFn, useEventListener } from '@vueuse/core'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code,
  LoaderCircle,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Presentation,
} from 'lucide-vue-next'
import {
  formatEntryNameValidationChars,
  getEntryNameValidationIssue,
} from '~/shared/entryNameValidation'
import { shouldSyncSelectedNoteContent } from './editorSync'
import { getTextStats, shouldApplyTextStatsUpdate } from './textStats'

const {
  notes,
  displayedNoteRecord,
  selectedNote,
  selectedNoteRecordStatus,
  retrySelectedNote,
  updateNoteContent,
  isNotesLoading,
  isNotesLoadingVisible,
} = useNotes()
const displayedNote = computed(() => displayedNoteRecord.value)
const { canGoBack, canGoForward } = useNavigationHistory()
const { addToUpdateQueue } = useNoteUpdate()

function hasSiblingNoteNameConflict(value: string, excludeId: number) {
  const normalized = value.trim().toLowerCase()
  if (!normalized || !displayedNote.value) {
    return false
  }
  const folderId = displayedNote.value.folder?.id ?? null
  return (notes.value ?? []).some(
    note =>
      note.id !== excludeId
      && (note.folder?.id ?? null) === folderId
      && note.name.toLowerCase() === normalized,
  )
}
const {
  isFocusedSearch,
  isFocusedNoteName,
  isNotesMindmapShown,
  isNotesPresentationShown,
  isNotesSidebarHidden,
  notesState,
  notesEditorMode,
  hideNotesViewModes,
  showNotesMindmap,
  showNotesPresentation,
  toggleNotesSidebar,
} = useNotesApp()

const sidebarActionTooltip = computed(() =>
  isNotesSidebarHidden.value
    ? i18n.t('action.showSidebar')
    : i18n.t('action.hideSidebar'),
)
const mindmapActionTooltip = computed(() =>
  isNotesMindmapShown.value
    ? `${i18n.t('action.hide')} ${i18n.t('menu:markdown.previewMindmap')}`
    : i18n.t('menu:markdown.previewMindmap'),
)
const presentationActionTooltip = computed(() =>
  isNotesPresentationShown.value
    ? i18n.t('action.hide')
    : i18n.t('menu:markdown.presentationMode'),
)
const isHistoryVisible = computed(() => canGoBack.value || canGoForward.value)
const isNameFocused = ref(false)
const isSelectedNoteContentReady = computed(
  () =>
    selectedNoteRecordStatus.value === 'ready'
    && selectedNote.value?.id === notesState.noteId
    && selectedNote.value.content !== undefined,
)

function onSidebarToggle() {
  toggleNotesSidebar()
}

function onBackClick() {
  void navigateBack()
}

function onForwardClick() {
  void navigateForward()
}

function onMindmapToggle() {
  if (isNotesMindmapShown.value) {
    hideNotesViewModes()
    return
  }

  showNotesMindmap()
}

function onPresentationToggle() {
  if (isNotesPresentationShown.value) {
    hideNotesViewModes()
    router.push({ name: RouterName.notesSpace })
    return
  }

  showNotesPresentation()
  router.push({ name: RouterName.notesPresentation })
}

const {
  model: name,
  onFocus: onNameFocus,
  onBlur,
  reset: resetName,
} = useEditableField(
  () => displayedNote.value?.name,
  (v) => {
    if (getEntryNameValidationIssue(v)) {
      return
    }

    if (
      !isSelectedNoteContentReady.value
      || !selectedNote.value
      || selectedNote.value.id !== displayedNote.value?.id
    ) {
      return
    }

    if (hasSiblingNoteNameConflict(v, selectedNote.value.id)) {
      return
    }

    addToUpdateQueue(selectedNote.value.id, { name: v })
  },
)

const nameValidationIssue = computed(() =>
  getEntryNameValidationIssue(name.value),
)
const hasNameConflict = computed(() => {
  if (nameValidationIssue.value || !displayedNote.value) {
    return false
  }

  if (
    name.value.trim().toLowerCase() === displayedNote.value.name.toLowerCase()
  ) {
    return false
  }

  return hasSiblingNoteNameConflict(name.value, displayedNote.value.id)
})
const nameValidationMessage = computed(() => {
  const issue = nameValidationIssue.value

  if (issue) {
    if (issue.code === 'invalidChars') {
      return i18n.t('messages:error.entryNameInvalidChars', {
        chars: formatEntryNameValidationChars(issue.chars),
      })
    }

    if (issue.code === 'leadingDot') {
      return i18n.t('messages:error.entryNameLeadingDot')
    }

    if (issue.code === 'trailingDot') {
      return i18n.t('messages:error.entryNameTrailingDot')
    }

    if (issue.code === 'windowsReserved') {
      return i18n.t('messages:error.entryNameWindowsReserved')
    }

    return i18n.t('messages:error.entryNameEmpty')
  }

  if (hasNameConflict.value) {
    return getEntryNameConflictMessage('note', i18n.t.bind(i18n))
  }

  return ''
})

const isNameValidationTooltipOpen = computed(() => {
  return isNameFocused.value && Boolean(nameValidationMessage.value)
})

const notesEditorRef = useTemplateRef('notesEditorRef')

function onNoteNameFocus() {
  isNameFocused.value = true
  onNameFocus()
}

function onNameBlur() {
  if (nameValidationIssue.value || hasNameConflict.value) {
    resetName()
  }

  isNameFocused.value = false
  onBlur()
  isFocusedNoteName.value = false
}

function onNameKeydown(event: KeyboardEvent) {
  if (
    (event.key !== 'Enter' && event.key !== 'Tab')
    || event.shiftKey
    || nameValidationIssue.value
    || hasNameConflict.value
  ) {
    return
  }

  event.preventDefault()
  hideNotesViewModes()

  nextTick(() => {
    notesEditorRef.value?.focusEditor()
  })
}

let searchShortcutRevision = 0
let pendingContentSearchNoteId: number | undefined

function openSelectedNoteContentSearch() {
  const noteId = notesState.noteId
  if (noteId === undefined)
    return

  hideNotesViewModes()
  const revision = ++searchShortcutRevision
  const shouldFocus = isSelectedNoteContentReady.value
  pendingContentSearchNoteId = shouldFocus ? undefined : noteId
  nextTick(() => {
    if (
      revision === searchShortcutRevision
      && selectedNote.value?.id === noteId
    ) {
      notesEditorRef.value?.openContentSearch(shouldFocus)
    }
  })
}

function onSearchShortcut(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f')
    return

  if (!event.shiftKey && notesState.noteId === undefined) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (event.shiftKey) {
    searchShortcutRevision += 1
    pendingContentSearchNoteId = undefined
    notesEditorRef.value?.closeContentSearch(false)
    isFocusedSearch.value = true
    return
  }

  openSelectedNoteContentSearch()
}

useEventListener(window, 'keydown', onSearchShortcut, { capture: true })
watch(
  () => notesState.noteId,
  () => {
    searchShortcutRevision += 1
    if (pendingContentSearchNoteId !== notesState.noteId)
      pendingContentSearchNoteId = undefined
  },
)

const editorContent = ref('')
// id заметки, контент которой сейчас находится в редакторе: меняется только
// вместе с editorContent, когда полная запись уже загружена.
const editorNoteId = ref<number | undefined>()
const statsContent = ref('')
let statsRevision = 0
const updateStatsContent = useDebounceFn(
  (noteId: number | undefined, value: string, revision: number) => {
    if (
      shouldApplyTextStatsUpdate(
        editorNoteId.value,
        statsRevision,
        noteId,
        revision,
      )
    ) {
      statsContent.value = value
    }
  },
  300,
)

watch(
  displayedNote,
  (nextNote, previousNote) => {
    if (nextNote?.id !== previousNote?.id)
      statsRevision += 1

    // Контент выбранной заметки ещё загружается — редактор обновится,
    // когда придёт полная запись.
    if (nextNote && nextNote.content === undefined) {
      return
    }

    if (
      editorNoteId.value === nextNote?.id
      && !shouldSyncSelectedNoteContent(previousNote, nextNote)
    ) {
      return
    }

    const nextContent = nextNote?.content ?? ''
    statsRevision += 1
    editorContent.value = nextContent
    editorNoteId.value = nextNote?.id
    statsContent.value = nextContent

    if (nextNote?.id === pendingContentSearchNoteId) {
      const revision = ++searchShortcutRevision
      pendingContentSearchNoteId = undefined
      nextTick(() => {
        if (
          revision === searchShortcutRevision
          && selectedNote.value?.id === nextNote.id
        ) {
          notesEditorRef.value?.openContentSearch()
        }
      })
    }
  },
  { immediate: true },
)

const content = computed({
  get: () => editorContent.value,
  set: (value: string) => {
    statsRevision += 1
    editorContent.value = value
    updateStatsContent(editorNoteId.value, value, statsRevision)

    // Сохраняем только если редактор отображает выбранную заметку:
    // в момент переключения ввод не должен уйти в новую заметку
    // с текстом старой.
    if (
      isSelectedNoteContentReady.value
      && selectedNote.value?.id === editorNoteId.value
    ) {
      updateNoteContent(selectedNote.value.id, value)
    }
  },
})

// При переключении заметки статистика обновляется сразу вместе с контентом,
// а во время набора остаётся debounced для больших документов.
const textStats = computed(() => getTextStats(statsContent.value))
const isSelectedNoteLoadingVisible = ref(false)
let selectedNoteLoadingTimer: ReturnType<typeof setTimeout> | undefined

watch(
  selectedNoteRecordStatus,
  (status) => {
    if (selectedNoteLoadingTimer)
      clearTimeout(selectedNoteLoadingTimer)
    selectedNoteLoadingTimer = undefined
    isSelectedNoteLoadingVisible.value = false

    if (status === 'loading') {
      selectedNoteLoadingTimer = setTimeout(() => {
        if (selectedNoteRecordStatus.value === 'loading')
          isSelectedNoteLoadingVisible.value = true
      }, 300)
    }
  },
  { immediate: true },
)
const { copy } = useClipboard()

function onCopyNoteMenu() {
  if (!isSelectedNoteContentReady.value)
    return

  const noteContent = selectedNote.value?.content
  if (noteContent === undefined)
    return
  copy(noteContent)
  useDonations().incrementCopy('notes')
}

ipc.on('main-menu:copy-note', onCopyNoteMenu)
ipc.on('main-menu:find', openSelectedNoteContentSearch)

// Компонент пересоздаётся при переходах dashboard/graph → workspace:
// без снятия listener каждый переход добавляет обработчик.
onBeforeUnmount(() => {
  if (selectedNoteLoadingTimer)
    clearTimeout(selectedNoteLoadingTimer)
  ipc.removeListeners('main-menu:copy-note')
  ipc.removeListeners('main-menu:find')
})
</script>

<template>
  <div
    v-if="displayedNote"
    class="relative flex h-full flex-col pt-[var(--content-top-offset)]"
  >
    <UiLoadingOverlay
      v-if="selectedNoteRecordStatus === 'loading'"
      :silent="!isSelectedNoteLoadingVisible"
    />
    <UiLoadingOverlay
      v-else-if="selectedNoteRecordStatus === 'error'"
      error
      :label="i18n.t('contentLoad.failed')"
      :action-label="i18n.t('contentLoad.retry')"
      @retry="retrySelectedNote"
    />
    <UiLoadingOverlay
      v-else-if="displayedNote.pendingCloudDownload"
      :label="i18n.t('cloudDownloads.itemPending')"
    />
    <div
      data-notes-editor-header
      :inert="!isSelectedNoteContentReady"
    >
      <div
        class="border-border grid grid-cols-[1fr_auto] items-center border-b px-2 pb-1"
      >
        <div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <div
            v-if="isHistoryVisible"
            class="flex shrink-0 items-center gap-0.5"
          >
            <UiActionButton
              :disabled="!canGoBack"
              :tooltip="i18n.t('menu:history.back')"
              @click="onBackClick"
            >
              <ChevronLeft class="h-3 w-3" />
            </UiActionButton>
            <UiActionButton
              :disabled="!canGoForward"
              :tooltip="i18n.t('menu:history.forward')"
              @click="onForwardClick"
            >
              <ChevronRight class="h-3 w-3" />
            </UiActionButton>
          </div>
          <div class="min-w-0 flex-1">
            <UiInputValidationTooltip
              :open="isNameValidationTooltipOpen"
              :message="nameValidationMessage"
            >
              <UiInput
                v-model="name"
                variant="ghost"
                class="w-full truncate px-0"
                :select="isFocusedNoteName"
                @focus="onNoteNameFocus"
                @blur="onNameBlur"
                @keydown="onNameKeydown"
              />
            </UiInputValidationTooltip>
          </div>
        </div>
        <div class="ml-2 flex h-7 items-center">
          <UiActionButton
            class="mr-1"
            :tooltip="sidebarActionTooltip"
            :active="isNotesSidebarHidden"
            @click="onSidebarToggle"
          >
            <PanelLeftOpen
              v-if="isNotesSidebarHidden"
              class="h-3 w-3"
            />
            <PanelLeftClose
              v-else
              class="h-3 w-3"
            />
          </UiActionButton>
          <UiActionButton
            :tooltip="mindmapActionTooltip"
            :active="isNotesMindmapShown"
            @click="onMindmapToggle"
          >
            <Network class="h-3 w-3 -rotate-90" />
          </UiActionButton>
          <UiActionButton
            :tooltip="presentationActionTooltip"
            :active="isNotesPresentationShown"
            @click="onPresentationToggle"
          >
            <Presentation class="h-3 w-3" />
          </UiActionButton>
        </div>
      </div>
      <div
        v-if="!isNotesMindmapShown && !isNotesPresentationShown"
        class="pt-1"
      >
        <NotesTaskMetadataBar :note="displayedNote" />
        <NotesEditorTags
          :note="displayedNote"
          :disabled="!isSelectedNoteContentReady"
        />
      </div>
    </div>
    <div
      class="min-h-0 flex-1"
      :inert="!isSelectedNoteContentReady"
    >
      <NotesMindmap v-if="isNotesMindmapShown" />
      <div
        v-else
        class="grid h-full grid-rows-[1fr_auto] overflow-hidden"
      >
        <div class="min-h-0">
          <NotesEditor
            ref="notesEditorRef"
            v-model:content="content"
            :disabled="!isSelectedNoteContentReady"
            :mode="notesEditorMode"
            :note-id="editorNoteId"
          />
        </div>
        <div
          data-notes-editor-footer
          class="border-border flex items-center justify-between border-t px-2 py-1 text-xs tabular-nums"
        >
          <Select.Select v-model="notesEditorMode">
            <Select.SelectTrigger variant="ghost">
              <Select.SelectValue>
                <Code
                  v-if="notesEditorMode === 'raw'"
                  class="size-3.5"
                />
                <Pencil
                  v-else-if="notesEditorMode === 'livePreview'"
                  class="size-3.5"
                />
                <BookOpen
                  v-else
                  class="size-3.5"
                />
              </Select.SelectValue>
            </Select.SelectTrigger>
            <Select.SelectContent align="start">
              <Select.SelectItem value="raw">
                <Code class="size-3.5" />
                Raw
              </Select.SelectItem>
              <Select.SelectItem value="livePreview">
                <Pencil class="size-3.5" />
                Live Preview
              </Select.SelectItem>
              <Select.SelectItem value="preview">
                <BookOpen class="size-3.5" />
                Preview
              </Select.SelectItem>
            </Select.SelectContent>
          </Select.Select>
          <div class="mr-1">
            {{ i18n.t("notes.words") }} {{ textStats.words }},
            {{ i18n.t("notes.symbols") }} {{ textStats.symbols }}
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else-if="notesState.noteId !== undefined"
    class="relative h-full"
  >
    <UiLoadingOverlay
      v-if="selectedNoteRecordStatus === 'loading'"
      :silent="!isSelectedNoteLoadingVisible"
    />
    <UiLoadingOverlay
      v-else-if="selectedNoteRecordStatus === 'error'"
      error
      :label="i18n.t('contentLoad.failed')"
      :action-label="i18n.t('contentLoad.retry')"
      @retry="retrySelectedNote"
    />
  </div>
  <div
    v-else-if="isNotesLoadingVisible"
    class="text-muted-foreground flex h-full items-center justify-center"
  >
    <LoaderCircle class="h-4 w-4 animate-spin" />
  </div>
  <div
    v-else-if="isNotesLoading"
    class="h-full"
  />
  <div
    v-else
    class="text-muted-foreground flex h-full items-center justify-center"
  >
    {{ i18n.t("notes.noSelected") }}
  </div>
</template>
