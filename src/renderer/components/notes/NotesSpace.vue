<script setup lang="ts">
import { useNotesApp, useNotesSpaceInitialization } from '@/composables'
import { store } from '@/electron'
import { RouterName } from '@/router'
import { useRoute } from 'vue-router'

const { isNotesListHidden, isNotesSidebarHidden } = useNotesApp()
const { initNotesSpace } = useNotesSpaceInitialization()
const route = useRoute()

void initNotesSpace()

const storedThreePanel = store.app.get('notes.layout.threePanel') as
  | number[]
  | undefined

const sidebarWidth
  = storedThreePanel?.length === 2 ? storedThreePanel[0] : undefined
const listWidth = (() => {
  if (storedThreePanel?.length === 2)
    return storedThreePanel[1]
  const twoPanel = store.app.get('notes.layout.twoPanel') as number | undefined
  return twoPanel ?? undefined
})()

function onResizeEnd(sw: number, lw: number) {
  store.app.set('notes.layout.threePanel', [sw, lw])
}

function onTwoPanelResize(lw: number) {
  store.app.set('notes.layout.twoPanel', lw)
}

const isWorkspaceRoute = computed(() => route.name === RouterName.notesSpace)
const isSidebarShown = computed(() =>
  isWorkspaceRoute.value ? !isNotesSidebarHidden.value : true,
)
const isListShown = computed(() =>
  isWorkspaceRoute.value ? !isNotesListHidden.value : false,
)
</script>

<template>
  <LayoutThreeColumn
    :show-sidebar="isSidebarShown"
    :show-list="isListShown"
    :sidebar-width="sidebarWidth"
    :list-width="listWidth"
    @resize-end="onResizeEnd"
    @two-panel-resize="onTwoPanelResize"
  >
    <template #sidebar>
      <NotesSidebar />
    </template>
    <template #list>
      <NotesList />
    </template>
    <template #editor>
      <NotesEditorPane v-if="isWorkspaceRoute" />
      <RouterView v-else />
    </template>
  </LayoutThreeColumn>
</template>
