<script setup lang="ts">
import { initCodeSpace, useApp, useSnippets } from '@/composables'
import { getCodePanels } from '@/composables/layoutModes'
import { scrollToSnippetIndex } from '@/composables/useSnippetScroller'
import { store } from '@/electron'
import { scrollToElement } from '@/utils'

const {
  codeLayoutMode,
  isAppLoading,
  isCodeSpaceInitialized,
  pendingCodeNavigation,
  state,
} = useApp()
const { displayedSnippets } = useSnippets()

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

async function initApp() {
  if (pendingCodeNavigation.value) {
    return
  }

  if (isCodeSpaceInitialized.value) {
    isAppLoading.value = false
    return
  }

  isAppLoading.value = true
  await initCodeSpace()

  nextTick(() => {
    scrollToElement(`[id="${state.folderId}"]`)

    const index
      = displayedSnippets.value?.findIndex(s => s.id === state.snippetId) ?? -1
    if (index >= 0) {
      scrollToSnippetIndex(index)
    }
  })

  isAppLoading.value = false
}

void initApp()
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
