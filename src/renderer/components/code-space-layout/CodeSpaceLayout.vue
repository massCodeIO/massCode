<script setup lang="ts">
import * as Resizable from '@/components/ui/shadcn/resizable'
import { useApp } from '@/composables'
import { store } from '@/electron'

const { isSidebarHidden } = useApp()

const storedLayout = store.app.get('sizes.layout') as number[] | undefined
const defaultLayout = storedLayout || [15, 20, 65]

function onLayout(layout: number[]) {
  store.app.set('sizes.layout', layout)
}
</script>

<template>
  <div
    v-if="isSidebarHidden"
    class="h-screen"
  >
    <Editor />
  </div>
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
      <Sidebar />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultLayout[1]"
      :min-size="10"
    >
      <SnippetList />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultLayout[2]"
      :min-size="30"
    >
      <Editor />
    </Resizable.ResizablePanel>
  </Resizable.ResizablePanelGroup>
</template>
