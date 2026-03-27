<script setup lang="ts">
import * as Resizable from '@/components/ui/shadcn/resizable'
import { useApp } from '@/composables'
import { getCodePanels } from '@/composables/layoutModes'
import { store } from '@/electron'

const { codeLayoutMode } = useApp()

const storedThreePanelLayout = store.app.get('code.layout.threePanel') as
  | number[]
  | undefined
const storedTwoPanelLayout = store.app.get('code.layout.twoPanel') as
  | number[]
  | undefined
const defaultThreePanelLayout = storedThreePanelLayout || [15, 20, 65]
const defaultTwoPanelLayout = storedTwoPanelLayout || [35, 65]
const panels = computed(() => getCodePanels(codeLayoutMode.value))

function onLayout(layout: number[]) {
  if (layout.length === 3) {
    store.app.set('code.layout.threePanel', layout)
    return
  }

  if (layout.length === 2) {
    store.app.set('code.layout.twoPanel', layout)
  }
}
</script>

<template>
  <div
    v-if="!panels.showList"
    class="h-screen"
  >
    <Editor />
  </div>
  <Resizable.ResizablePanelGroup
    v-else-if="!panels.showSidebar"
    direction="horizontal"
    class="h-screen"
    @layout="onLayout"
  >
    <Resizable.ResizablePanel
      :default-size="defaultTwoPanelLayout[0]"
      :min-size="15"
    >
      <SnippetList />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultTwoPanelLayout[1]"
      :min-size="30"
    >
      <Editor />
    </Resizable.ResizablePanel>
  </Resizable.ResizablePanelGroup>
  <Resizable.ResizablePanelGroup
    v-else
    direction="horizontal"
    class="h-screen"
    @layout="onLayout"
  >
    <Resizable.ResizablePanel
      :default-size="defaultThreePanelLayout[0]"
      :min-size="10"
    >
      <Sidebar />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultThreePanelLayout[1]"
      :min-size="10"
    >
      <SnippetList />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultThreePanelLayout[2]"
      :min-size="30"
    >
      <Editor />
    </Resizable.ResizablePanel>
  </Resizable.ResizablePanelGroup>
</template>
