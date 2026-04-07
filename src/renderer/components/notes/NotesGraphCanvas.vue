<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useNotesGraph, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import {
  ArrowLeft,
  LoaderCircle,
  LocateFixed,
  RefreshCw,
} from 'lucide-vue-next'
import { loadNotesGraphIfNeeded } from './notesGraphLoader'

interface GraphSceneExposed {
  resetViewport: () => void
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
  <div class="h-full overflow-hidden">
    <div class="mx-auto flex h-full max-w-7xl flex-col gap-4 p-5">
      <UiPageHeader
        :title="i18n.t('notes.dashboard.graph.title')"
        :description="i18n.t('notes.dashboard.graph.description')"
      >
        <template #actions>
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
        </template>
      </UiPageHeader>

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
        class="relative flex-1 overflow-hidden rounded-xl border bg-[#1e1e1e]"
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
  </div>
</template>
