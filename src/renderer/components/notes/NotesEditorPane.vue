<script setup lang="ts">
import { useNotes, useNotesApp, useNoteUpdate } from '@/composables'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import {
  InspectionPanel,
  LoaderCircle,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
} from 'lucide-vue-next'
import { getTextStats } from './textStats'

const {
  selectedNote,
  updateNoteContent,
  isNotesLoading,
  isNotesLoadingVisible,
} = useNotes()
const { addToUpdateQueue } = useNoteUpdate()
const {
  hideNotesSidebar,
  isFocusedNoteName,
  isNotesMindmapShown,
  isNotesListHidden,
  isNotesPresentationShown,
  isNotesSidebarHidden,
  hideNotesViewModes,
  showAllNotesPanels,
  showNotesMindmap,
  showNotesPresentation,
  showNotesEditorOnly,
} = useNotesApp()

const isSidebarOnlyHidden = computed(
  () => isNotesSidebarHidden.value && !isNotesListHidden.value,
)
const isEditorOnly = computed(
  () => isNotesSidebarHidden.value && isNotesListHidden.value,
)
const sidebarActionTooltip = computed(() =>
  isSidebarOnlyHidden.value
    ? i18n.t('action.showSidebar')
    : i18n.t('action.hideSidebar'),
)
const editorOnlyActionTooltip = computed(() =>
  isEditorOnly.value
    ? i18n.t('action.showSidebarAndList')
    : i18n.t('action.hideSidebarAndList'),
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
  if (isSidebarOnlyHidden.value) {
    showAllNotesPanels()
    return
  }

  hideNotesSidebar()
}

function onEditorOnlyToggle() {
  if (isEditorOnly.value) {
    showAllNotesPanels()
    return
  }

  showNotesEditorOnly()
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

const name = computed({
  get() {
    return selectedNote.value?.name
  },
  set(v: string) {
    if (selectedNote.value) {
      addToUpdateQueue(selectedNote.value.id, { name: v })
    }
  },
})

const editorContent = ref('')

watch(
  () => selectedNote.value?.id,
  () => {
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
          @blur="isFocusedNoteName = false"
        />
        <div class="ml-2 flex h-7 items-center">
          <UiActionButton
            class="mr-1"
            :tooltip="sidebarActionTooltip"
            :active="isSidebarOnlyHidden"
            @click="onSidebarToggle"
          >
            <PanelLeftOpen
              v-if="isSidebarOnlyHidden"
              class="h-3 w-3"
            />
            <PanelLeftClose
              v-else
              class="h-3 w-3"
            />
          </UiActionButton>
          <UiActionButton
            :tooltip="editorOnlyActionTooltip"
            :active="isEditorOnly"
            @click="onEditorOnlyToggle"
          >
            <InspectionPanel class="h-3 w-3" />
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
          />
        </div>
        <div
          data-notes-editor-footer
          class="border-border flex items-center justify-between border-t px-2 py-1 text-xs tabular-nums"
        >
          <div />
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
