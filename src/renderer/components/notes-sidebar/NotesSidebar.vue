<script setup lang="ts">
import {
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNoteTags,
} from '@/composables'
import { i18n } from '@/electron'
import { scrollToElement } from '@/utils'

const { isNotesSpaceInitialized, notesState } = useNotesApp()
const { getNoteFolders } = useNoteFolders()
const { getNotes, selectFirstNote, displayedNotes } = useNotes()
const { getNoteTags } = useNoteTags()

async function initNotesSpace() {
  if (isNotesSpaceInitialized.value) {
    return
  }

  const results = await Promise.allSettled([
    getNoteFolders(),
    getNotes(),
    getNoteTags(),
  ])

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('Notes init error:', result.reason)
    }
  })

  isNotesSpaceInitialized.value = results.every(
    result => result.status === 'fulfilled',
  )

  if (!notesState.noteId && displayedNotes.value?.length) {
    selectFirstNote()
  }

  nextTick(() => {
    if (notesState.folderId) {
      scrollToElement(`[id="${notesState.folderId}"]`)
    }
  })
}

void initNotesSpace()
</script>

<template>
  <div
    data-notes-sidebar
    class="flex h-full flex-col px-1 pt-[var(--content-top-offset)]"
  >
    <div class="truncate px-1 pb-2 font-bold select-none">
      {{ i18n.t("notes.plural") }}
    </div>
    <UiText
      as="div"
      variant="caption"
      weight="bold"
      uppercase
      class="flex gap-1 pb-1 pl-1 select-none"
    >
      {{ i18n.t("sidebar.library") }}
    </UiText>
    <NotesSidebarLibrary />
    <UiText
      as="div"
      variant="caption"
      weight="bold"
      uppercase
      class="mt-2 flex gap-1 pb-1 pl-1 select-none"
    >
      {{ i18n.t("sidebar.tags") }}
    </UiText>
    <NotesSidebarTags />
    <NotesSidebarFolders />
  </div>
</template>
