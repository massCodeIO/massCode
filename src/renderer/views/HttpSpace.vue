<script setup lang="ts">
import { useApp, useHttpApp, useHttpSpaceInit } from '@/composables'
import { store } from '@/electron'

const { isAppLoading } = useApp()
const { initHttpSpace } = useHttpSpaceInit()
const { isHttpSidebarHidden, isHttpListHidden } = useHttpApp()

void initHttpSpace()

const storedThreePanel = store.app.get('http.layout.threePanel') as
  | number[]
  | undefined

const sidebarWidth
  = storedThreePanel?.length === 2 ? storedThreePanel[0] : undefined
const listWidth = (() => {
  if (storedThreePanel?.length === 2)
    return storedThreePanel[1]
  const twoPanel = store.app.get('http.layout.twoPanel') as number | undefined
  return twoPanel ?? undefined
})()

function onResizeEnd(sw: number, lw: number) {
  store.app.set('http.layout.threePanel', [sw, lw])
}

function onTwoPanelResize(lw: number) {
  store.app.set('http.layout.twoPanel', lw)
}

const isSidebarShown = computed(() => !isHttpSidebarHidden.value)
const isListShown = computed(() => !isHttpListHidden.value)

onMounted(() => {
  isAppLoading.value = false
})
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
      <HttpSidebar />
    </template>
    <template #list>
      <HttpRequestsList />
    </template>
    <template #editor>
      <HttpRequestEditorPane />
    </template>
  </LayoutThreeColumn>
</template>
