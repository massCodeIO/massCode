<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useNotesGraph, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import {
  ArrowLeft,
  LoaderCircle,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
import { buildNotesGraphLayout } from './notesGraphLayout'

const {
  graphData,
  graphError,
  isGraphLoading,
  getNotesGraph,
  navigateBackToDashboard,
} = useNotesGraph()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()

const zoom = ref(1)

const graphLayout = computed(() =>
  buildNotesGraphLayout(
    graphData.value?.nodes ?? [],
    graphData.value?.edges ?? [],
  ),
)

function zoomIn() {
  zoom.value = Math.min(1.8, Number((zoom.value + 0.1).toFixed(1)))
}

function zoomOut() {
  zoom.value = Math.max(0.6, Number((zoom.value - 0.1).toFixed(1)))
}

onMounted(() => {
  if (!graphData.value) {
    void getNotesGraph()
  }
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
          @click="zoomOut"
        >
          <ZoomOut class="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          @click="zoomIn"
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
      v-else-if="!graphLayout.nodes.length"
      :text="i18n.t('notes.dashboard.graph.empty')"
    />

    <div
      v-else
      class="flex-1 overflow-auto"
    >
      <div
        class="min-h-full min-w-full p-6"
        :style="{
          width: `${graphLayout.width * zoom}px`,
          height: `${graphLayout.height * zoom}px`,
        }"
      >
        <svg
          class="block"
          :viewBox="`0 0 ${graphLayout.width} ${graphLayout.height}`"
          :width="graphLayout.width * zoom"
          :height="graphLayout.height * zoom"
        >
          <line
            v-for="edge in graphLayout.edges"
            :key="`${edge.source}-${edge.target}`"
            :x1="graphLayout.nodes.find((node) => node.id === edge.source)?.x"
            :y1="graphLayout.nodes.find((node) => node.id === edge.source)?.y"
            :x2="graphLayout.nodes.find((node) => node.id === edge.target)?.x"
            :y2="graphLayout.nodes.find((node) => node.id === edge.target)?.y"
            stroke="currentColor"
            class="text-border"
            stroke-width="1.5"
          />
          <g
            v-for="node in graphLayout.nodes"
            :key="node.id"
            class="cursor-pointer"
            @click="openNoteInNotesWorkspace(node.id)"
          >
            <rect
              :x="node.x - node.width / 2"
              :y="node.y - node.height / 2"
              :width="node.width"
              :height="node.height"
              rx="14"
              :class="
                node.incomingLinksCount > 0
                  ? 'fill-primary/12 stroke-primary'
                  : 'fill-card stroke-border'
              "
              stroke-width="1.5"
            />
            <text
              :x="node.x"
              :y="node.y"
              text-anchor="middle"
              dominant-baseline="central"
              class="fill-foreground text-[12px] font-medium"
            >
              {{
                node.name.length > 24 ? `${node.name.slice(0, 24)}…` : node.name
              }}
            </text>
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>
