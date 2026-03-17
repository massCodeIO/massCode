<script setup lang="ts">
import { useNotes, useNotesApp } from '@/composables'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'

const {
  selectedNote,
  updateNote,
  updateNoteContent,
  isNotesLoading,
  isNotesLoadingVisible,
} = useNotes()
const { isFocusedNoteName } = useNotesApp()

const name = computed({
  get() {
    return selectedNote.value?.name
  },
  set(v: string) {
    if (selectedNote.value) {
      updateNote(selectedNote.value.id, { name: v })
    }
  },
})

const content = computed({
  get: () => selectedNote.value?.content ?? '',
  set: (value: string) => {
    if (selectedNote.value) {
      updateNoteContent(selectedNote.value.id, value)
    }
  },
})
</script>

<template>
  <div
    v-if="selectedNote"
    class="flex h-full flex-col pt-[var(--content-top-offset)]"
  >
    <div data-notes-editor-header>
      <div
        class="border-border grid min-h-7 grid-cols-[1fr_auto] items-center border-b px-2 pb-1"
      >
        <UiInput
          v-model="name"
          variant="ghost"
          class="w-full truncate px-0"
          :select="isFocusedNoteName"
          @blur="isFocusedNoteName = false"
        />
        <div class="ml-2 flex h-7 items-center">
          <!-- Action buttons slot for future use -->
        </div>
      </div>
      <div class="pt-1">
        <NotesEditorPaneNotesEditorTags />
      </div>
    </div>
    <div class="min-h-0 flex-1">
      <NotesEditor
        :key="selectedNote.id"
        v-model:content="content"
      />
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
