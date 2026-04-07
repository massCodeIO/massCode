<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useNotesGraph, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import {
  ArrowLeft,
  LoaderCircle,
  LocateFixed,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
import { loadNotesGraphIfNeeded } from './notesGraphLoader'

interface GraphSceneExposed {
  resetViewport: () => void
  zoomIn: () => void
  zoomOut: () => void
}

const {
  graphData,
  graphError,
  isGraphLoading,
  getNotesGraph,
  navigateBackToDashboard,
} = useNotesGraph()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()

const graphSceneRef = ref<GraphSceneExposed | null>(null)

onMounted(() => {
  loadNotesGraphIfNeeded(graphData.value, getNotesGraph)
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div
      class="border-border flex items-center justify-between gap-3 border-b px-5 py-4"
    >
      <div>
        <h1 class="text-lg font-semibold">
          {{ i18n.t("notes.dashboard.graph.title") }}
        </h1>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ i18n.t("notes.dashboard.graph.description") }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          @click="navigateBackToDashboard"
        >
          <ArrowLeft class="mr-2 h-4 w-4" />
          {{ i18n.t("notes.dashboard.actions.backToDashboard") }}
        </Button>
        <Button
          size="icon"
          variant="outline"
          @click="graphSceneRef?.zoomOut()"
        >
          <ZoomOut class="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          @click="graphSceneRef?.zoomIn()"
        >
          <ZoomIn class="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          @click="getNotesGraph"
        >
          <RefreshCw class="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          @click="graphSceneRef?.resetViewport()"
        >
          <LocateFixed class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div
      v-if="isGraphLoading && !graphData"
      class="text-muted-foreground flex flex-1 items-center justify-center"
    >
      <LoaderCircle class="h-5 w-5 animate-spin" />
    </div>

    <UiEmptyPlaceholder
      v-else-if="graphError"
      :text="i18n.t('notes.dashboard.graph.error')"
    />

    <UiEmptyPlaceholder
      v-else-if="!graphData?.nodes.length"
      :text="i18n.t('notes.dashboard.graph.empty')"
    />

    <div
      v-else
      class="relative flex-1 overflow-hidden bg-[#1e1e1e]"
    >
      <NotesGraphScene
        ref="graphSceneRef"
        :nodes="graphData.nodes"
        :edges="graphData.edges"
        :width="1000"
        :height="720"
        @node-click="openNoteInNotesWorkspace"
      >
        <template #overlay="{ activeNode, neighborCount }">
          <div
            class="pointer-events-none absolute right-4 bottom-4 text-[11px] text-white/55"
          >
            {{
              activeNode
                ? i18n.t("notes.dashboard.graph.meta", {
                  links: activeNode.incomingLinksCount,
                  neighbors: neighborCount,
                })
                : i18n.t("notes.dashboard.graph.hint")
            }}
          </div>
        </template>
      </NotesGraphScene>
    </div>
  </div>
</template>
