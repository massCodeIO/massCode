<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import {
  useEditableField,
  useNavigationHistory,
  useNotes,
  useNotesApp,
  useNoteUpdate,
} from '@/composables'
import { i18n } from '@/electron'
import { navigateBack, navigateForward } from '@/ipc/listeners/deepLinks'
import { router, RouterName } from '@/router'
import { getEntryNameConflictMessage } from '@/utils'
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
import { getTextStats } from './textStats'

const {
  notes,
  selectedNote,
  updateNoteContent,
  isNotesLoading,
  isNotesLoadingVisible,
} = useNotes()
const { canGoBack, canGoForward } = useNavigationHistory()
const { addToUpdateQueue } = useNoteUpdate()

function hasSiblingNoteNameConflict(value: string, excludeId: number) {
  const normalized = value.trim().toLowerCase()
  if (!normalized || !selectedNote.value) {
    return false
  }
  const folderId = selectedNote.value.folder?.id ?? null
  return (notes.value ?? []).some(
    note =>
      note.id !== excludeId
      && (note.folder?.id ?? null) === folderId
      && note.name.toLowerCase() === normalized,
  )
}
const {
  isFocusedNoteName,
  isNotesMindmapShown,
  isNotesPresentationShown,
  isNotesSidebarHidden,
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
  () => selectedNote.value?.name,
  (v) => {
    if (getEntryNameValidationIssue(v)) {
      return
    }

    if (!selectedNote.value) {
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
  if (nameValidationIssue.value || !selectedNote.value) {
    return false
  }

  if (
    name.value.trim().toLowerCase() === selectedNote.value.name.toLowerCase()
  ) {
    return false
  }

  return hasSiblingNoteNameConflict(name.value, selectedNote.value.id)
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

const editorContent = ref('')

watch(
  selectedNote,
  (nextNote, previousNote) => {
    if (!shouldSyncSelectedNoteContent(previousNote, nextNote)) {
      return
    }

    editorContent.value = selectedNote.value?.content ?? ''
  },
  { immediate: true },
)

const content = computed({
  get: () => editorContent.value,
  set: (value: string) => {
    editorContent.value = value

    if (selectedNote.value) {
      updateNoteContent(selectedNote.value.id, value)
    }
  },
})

const textStats = computed(() => getTextStats(content.value))
</script>

<template>
  <div
    v-if="selectedNote"
    class="flex h-full flex-col pt-[var(--content-top-offset)]"
  >
    <div data-notes-editor-header>
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
        <NotesEditorTags />
      </div>
    </div>
    <div class="min-h-0 flex-1">
      <NotesMindmap v-if="isNotesMindmapShown" />
      <div
        v-else
        class="grid h-full grid-rows-[1fr_auto] overflow-hidden"
      >
        <div class="min-h-0">
          <NotesEditor
            :key="selectedNote.id"
            v-model:content="content"
            :mode="notesEditorMode"
            :note-id="selectedNote.id"
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
