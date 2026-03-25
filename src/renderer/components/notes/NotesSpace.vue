<script setup lang="ts">
import * as Resizable from '@/components/ui/shadcn/resizable'
import { useNotesApp, useNotesSpaceInitialization } from '@/composables'
import { store } from '@/electron'

const { isNotesListHidden, isNotesSidebarHidden } = useNotesApp()
const { initNotesSpace } = useNotesSpaceInitialization()

void initNotesSpace()

const storedLayout = store.app.get('sizes.notesLayout') as number[] | undefined
const defaultLayout = storedLayout || [15, 20, 65]
const storedLayoutWithoutSidebar = store.app.get(
  'sizes.notesLayoutWithoutSidebar',
) as number[] | undefined

function normalizeTwoPanelLayout(
  layout: number[] | undefined,
  fallback: number[],
): number[] {
  if (
    !layout
    || layout.length !== 2
    || layout.some(value => !Number.isFinite(value) || value <= 0)
  ) {
    return fallback
  }

  return layout
}

const fallbackLayoutWithoutSidebar = (() => {
  const listSize = Number(defaultLayout[1]) || 20
  const editorSize = Number(defaultLayout[2]) || 65
  const total = listSize + editorSize

  if (total <= 0) {
    return [24, 76]
  }

  const normalizedListSize = Math.round((listSize / total) * 100)

  return [normalizedListSize, 100 - normalizedListSize]
})()

const defaultLayoutWithoutSidebar = normalizeTwoPanelLayout(
  storedLayoutWithoutSidebar,
  fallbackLayoutWithoutSidebar,
)

function onLayout(layout: number[]) {
  store.app.set('sizes.notesLayout', layout)
}

function onLayoutWithoutSidebar(layout: number[]) {
  store.app.set('sizes.notesLayoutWithoutSidebar', layout)
}
</script>

<template>
  <div
    v-if="isNotesSidebarHidden && isNotesListHidden"
    class="h-screen"
  >
    <NotesEditorPane />
  </div>
  <Resizable.ResizablePanelGroup
    v-else-if="isNotesSidebarHidden"
    direction="horizontal"
    class="h-screen"
    @layout="onLayoutWithoutSidebar"
  >
    <Resizable.ResizablePanel
      :default-size="defaultLayoutWithoutSidebar[0]"
      :min-size="10"
    >
      <NotesList />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultLayoutWithoutSidebar[1]"
      :min-size="30"
    >
      <NotesEditorPane />
    </Resizable.ResizablePanel>
  </Resizable.ResizablePanelGroup>
  <Resizable.ResizablePanelGroup
    v-else
    direction="horizontal"
    class="h-screen"
    @layout="onLayout"
  >
    <Resizable.ResizablePanel
      :default-size="defaultLayout[0]"
      :min-size="10"
    >
      <NotesSidebar />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultLayout[1]"
      :min-size="10"
    >
      <NotesList />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultLayout[2]"
      :min-size="30"
    >
      <NotesEditorPane />
    </Resizable.ResizablePanel>
  </Resizable.ResizablePanelGroup>
</template>
