<script setup lang="ts">
import { useNotes } from '@/composables'
import { i18n } from '@/electron'

const { selectedNote, updateNoteContent } = useNotes()

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
    class="h-full pt-[var(--content-top-offset)]"
  >
    <NotesEditor v-model:content="content" />
  </div>
  <div
    v-else
    class="text-muted-foreground flex h-full items-center justify-center"
  >
    {{ i18n.t("notes.noSelected") }}
  </div>
</template>
