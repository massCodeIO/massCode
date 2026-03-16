<script setup lang="ts">
import * as Resizable from '@/components/ui/shadcn/resizable'
import { store } from '@/electron'

const storedLayout = store.app.get('sizes.notesLayout') as number[] | undefined
const defaultLayout = storedLayout || [15, 20, 65]

function onLayout(layout: number[]) {
  store.app.set('sizes.notesLayout', layout)
}
</script>

<template>
  <Resizable.ResizablePanelGroup
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
