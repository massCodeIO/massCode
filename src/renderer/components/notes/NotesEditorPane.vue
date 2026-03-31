<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import {
  useEditableField,
  useNotes,
  useNotesApp,
  useNoteUpdate,
} from '@/composables'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import {
  BookOpen,
  Code,
  LoaderCircle,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Presentation,
} from 'lucide-vue-next'
import { shouldSyncSelectedNoteContent } from './editorSync'
import { getTextStats } from './textStats'

const {
  selectedNote,
  updateNoteContent,
  isNotesLoading,
  isNotesLoadingVisible,
} = useNotes()
const { addToUpdateQueue } = useNoteUpdate()
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

function onSidebarToggle() {
  toggleNotesSidebar()
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
} = useEditableField(
  () => selectedNote.value?.name,
  (v) => {
    if (selectedNote.value) {
      addToUpdateQueue(selectedNote.value.id, { name: v })
    }
  },
)

function onNameBlur() {
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
        <UiInput
          v-model="name"
          variant="ghost"
          class="w-full truncate px-0"
          :select="isFocusedNoteName"
          @focus="onNameFocus"
          @blur="onNameBlur"
        />
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
