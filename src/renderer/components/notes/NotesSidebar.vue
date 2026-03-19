<script setup lang="ts">
import { useNotesApp } from '@/composables'
import { i18n } from '@/electron'
import { scrollToElement } from '@/utils'

const { notesState } = useNotesApp()

function scrollToCurrentFolder() {
  if (!notesState.folderId) {
    return
  }

  scrollToElement(`[id="${notesState.folderId}"]`)
}

nextTick(() => {
  scrollToCurrentFolder()
})
</script>

<template>
  <div
    data-notes-sidebar
    class="flex h-full flex-col px-1 pt-[var(--content-top-offset)]"
  >
    <SidebarHeader :title="i18n.t('notes.plural')" />
    <NotesSidebarLibrary />
    <NotesSidebarFolders />
  </div>
</template>
