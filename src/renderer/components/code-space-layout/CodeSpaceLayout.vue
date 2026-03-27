<script setup lang="ts">
import { useApp } from '@/composables'
import { getCodePanels } from '@/composables/layoutModes'
import { store } from '@/electron'

const { codeLayoutMode } = useApp()

const panels = computed(() => getCodePanels(codeLayoutMode.value))

const storedThreePanel = store.app.get('code.layout.threePanel') as
  | number[]
  | undefined

const sidebarWidth
  = storedThreePanel?.length === 2 ? storedThreePanel[0] : undefined
const listWidth = (() => {
  if (storedThreePanel?.length === 2)
    return storedThreePanel[1]
  const twoPanel = store.app.get('code.layout.twoPanel') as number | undefined
  return twoPanel ?? undefined
})()

function onResizeEnd(sw: number, lw: number) {
  store.app.set('code.layout.threePanel', [sw, lw])
}

function onTwoPanelResize(lw: number) {
  store.app.set('code.layout.twoPanel', lw)
}
</script>

<template>
  <LayoutThreeColumn
    :show-sidebar="panels.showSidebar"
    :show-list="panels.showList"
    :sidebar-width="sidebarWidth"
    :list-width="listWidth"
    @resize-end="onResizeEnd"
    @two-panel-resize="onTwoPanelResize"
  >
    <template #sidebar>
      <Sidebar />
    </template>
    <template #list>
      <SnippetList />
    </template>
    <template #editor>
      <Editor />
    </template>
  </LayoutThreeColumn>
</template>
