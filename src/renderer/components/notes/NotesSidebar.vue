<script setup lang="ts">
import { useNavigationHistory, useNotesApp } from '@/composables'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { scrollToElement } from '@/utils'
import { LayoutGrid } from 'lucide-vue-next'

const { notesState } = useNotesApp()
const { isNavigatingHistory, recordNavigation } = useNavigationHistory()

function scrollToCurrentFolder() {
  if (!notesState.folderId) {
    return
  }

  scrollToElement(`[id="${notesState.folderId}"]`)
}

nextTick(() => {
  scrollToCurrentFolder()
})

async function openDashboard() {
  if (router.currentRoute.value.name === RouterName.notesDashboard) {
    return
  }

  if (isNavigatingHistory.value) {
    await router.push({ name: RouterName.notesDashboard })
    return
  }

  await recordNavigation(async () => {
    await router.push({ name: RouterName.notesDashboard })
  })
}
</script>

<template>
  <div
    data-notes-sidebar
    class="flex h-full flex-col px-1"
    style="
      padding-top: calc(var(--content-top-offset) + var(--header-gap, 0px));
    "
  >
    <SidebarHeader
      :title="i18n.t('notes.plural')"
      :section-title="i18n.t('common.library')"
    >
      <template #actions>
        <UiActionButton
          :tooltip="i18n.t('notes.dashboard.label')"
          @click="openDashboard"
        >
          <LayoutGrid class="h-4 w-4" />
        </UiActionButton>
      </template>
    </SidebarHeader>
    <NotesSidebarLibrary />
    <NotesSidebarFolders />
  </div>
</template>
