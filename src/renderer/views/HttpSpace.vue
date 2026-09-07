<script setup lang="ts">
import { useApp, useHttpApp, useHttpSpaceInit } from '@/composables'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { useHttpWebSocket } from '@/composables/spaces/http/useHttpWebSocket'
import { store } from '@/electron'

const { isAppLoading } = useApp()
const { initHttpSpace } = useHttpSpaceInit()
const { httpState, isHttpSidebarHidden } = useHttpApp()
if (httpState.activePanel === 'environments') {
  httpState.activePanel
    = httpState.folderId !== undefined ? 'folder' : 'request'
}

const { open: runnerOpen } = useHttpRunner()
if (httpState.activePanel === 'runner' && !runnerOpen.value) {
  httpState.activePanel
    = httpState.folderId !== undefined ? 'folder' : 'request'
}

const { dispose: disposeWebSocket } = useHttpWebSocket()
onBeforeUnmount(disposeWebSocket)

void initHttpSpace()

const storedThreePanel = store.app.get('http.layout.threePanel') as
  | number[]
  | undefined

const sidebarWidth
  = store.app.get<number>('http.layout.treeWidth')
    ?? storedThreePanel?.[0]
    ?? 260

function onResizeEnd(width: number) {
  store.app.set('http.layout.treeWidth', width)
}
const isSidebarShown = computed(() => !isHttpSidebarHidden.value)

onMounted(() => {
  isAppLoading.value = false
})
</script>

<template>
  <LayoutThreeColumn
    :show-sidebar="isSidebarShown"
    :show-list="false"
    :sidebar-width="sidebarWidth"
    @resize-end="onResizeEnd"
  >
    <template #sidebar>
      <HttpSidebar />
    </template>
    <template #editor>
      <div
        class="flex h-full min-h-0 flex-col"
        :class="{
          'pt-[var(--content-top-offset)]':
            httpState.activePanel === 'folder'
            || httpState.activePanel === 'runner',
        }"
      >
        <HttpContextHeader
          v-if="
            httpState.activePanel === 'folder'
              || httpState.activePanel === 'runner'
          "
        />
        <div
          class="min-h-0 flex-1"
          :class="{
            '[--content-top-offset:0px]':
              httpState.activePanel === 'folder'
              || httpState.activePanel === 'runner',
          }"
        >
          <HttpRunnerPanel v-show="httpState.activePanel === 'runner'" />
          <HttpCollectionEditor v-if="httpState.activePanel === 'folder'" />
          <HttpRequestEditorPane
            v-else-if="
              !httpState.activePanel || httpState.activePanel === 'request'
            "
          />
        </div>
      </div>
    </template>
  </LayoutThreeColumn>
  <HttpHistoryDialog />
</template>
