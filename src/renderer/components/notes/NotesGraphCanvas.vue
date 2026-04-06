<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useNotesGraph, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import { useElementSize } from '@vueuse/core'
import {
  ArrowLeft,
  LoaderCircle,
  LocateFixed,
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

const graphViewportRef = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight }
  = useElementSize(graphViewportRef)
const activeNodeId = ref<number | null>(null)
const zoom = ref(1)
const pan = reactive({
  x: 0,
  y: 0,
})
const dragState = reactive({
  active: false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
})

const graphLayout = computed(() =>
  buildNotesGraphLayout(
    graphData.value?.nodes ?? [],
    graphData.value?.edges ?? [],
  ),
)

const nodeMap = computed(
  () => new Map(graphLayout.value.nodes.map(node => [node.id, node])),
)

const neighborsById = computed(() => {
  const neighbors = new Map<number, Set<number>>()

  graphLayout.value.nodes.forEach((node) => {
    neighbors.set(node.id, new Set())
  })

  graphLayout.value.edges.forEach((edge) => {
    neighbors.get(edge.source)?.add(edge.target)
    neighbors.get(edge.target)?.add(edge.source)
  })

  return neighbors
})

const activeNeighborIds = computed(() => {
  if (!activeNodeId.value) {
    return new Set<number>()
  }

  return neighborsById.value.get(activeNodeId.value) ?? new Set<number>()
})

function getNodeRadius(incomingLinksCount: number) {
  return Math.min(18, 5 + incomingLinksCount * 1.65)
}

function resetViewport() {
  if (
    !graphLayout.value.nodes.length
    || !viewportWidth.value
    || !viewportHeight.value
  ) {
    return
  }

  const fittedZoom = Math.min(
    1.15,
    Math.max(
      0.58,
      Math.min(
        viewportWidth.value / (graphLayout.value.width + 120),
        viewportHeight.value / (graphLayout.value.height + 120),
      ),
    ),
  )

  zoom.value = Number(fittedZoom.toFixed(2))
  pan.x = (viewportWidth.value - graphLayout.value.width * zoom.value) / 2
  pan.y = (viewportHeight.value - graphLayout.value.height * zoom.value) / 2
}

function zoomIn() {
  zoom.value = Math.min(2.2, Number((zoom.value + 0.12).toFixed(2)))
}

function zoomOut() {
  zoom.value = Math.max(0.45, Number((zoom.value - 0.12).toFixed(2)))
}

function onWheel(event: WheelEvent) {
  const direction = event.deltaY > 0 ? -1 : 1
  const nextZoom = Math.min(2.4, Math.max(0.4, zoom.value + direction * 0.08))
  zoom.value = Number(nextZoom.toFixed(2))
}

function startPan(event: PointerEvent) {
  dragState.active = true
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.x = pan.x
  dragState.y = pan.y
}

function movePan(event: PointerEvent) {
  if (!dragState.active) {
    return
  }

  pan.x = dragState.x + event.clientX - dragState.startX
  pan.y = dragState.y + event.clientY - dragState.startY
}

function stopPan() {
  dragState.active = false
}

function isNodeHighlighted(nodeId: number) {
  if (!activeNodeId.value) {
    return false
  }

  return nodeId === activeNodeId.value || activeNeighborIds.value.has(nodeId)
}

function isEdgeHighlighted(source: number, target: number) {
  if (!activeNodeId.value) {
    return false
  }

  return source === activeNodeId.value || target === activeNodeId.value
}

onMounted(() => {
  if (!graphData.value) {
    void getNotesGraph()
  }
})

watch(
  [graphLayout, viewportWidth, viewportHeight],
  () => {
    resetViewport()
  },
  { immediate: true },
)
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
        <Button
          size="icon"
          variant="outline"
          @click="resetViewport"
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
      v-else-if="!graphLayout.nodes.length"
      :text="i18n.t('notes.dashboard.graph.empty')"
    />

    <div
      v-else
      ref="graphViewportRef"
      class="from-background via-background to-primary/10 relative flex-1 overflow-hidden bg-gradient-to-br bg-radial-[at_20%_20%]"
      @pointerleave="stopPan"
      @pointermove="movePan"
      @pointerup="stopPan"
      @wheel.prevent="onWheel"
    >
      <div class="pointer-events-none absolute inset-0 opacity-60">
        <div
          class="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(100,140,255,0.10),_transparent_42%)]"
        />
        <div
          class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(255,255,255,0.06),_transparent_28%)]"
        />
      </div>
      <svg
        class="h-full w-full touch-none"
        :class="{
          'cursor-grabbing': dragState.active,
          'cursor-grab': !dragState.active,
        }"
        viewBox="0 0 1000 720"
        @pointerdown="startPan"
      >
        <g :transform="`translate(${pan.x}, ${pan.y}) scale(${zoom})`">
          <g opacity="0.9">
            <line
              v-for="edge in graphLayout.edges"
              :key="`${edge.source}-${edge.target}`"
              :x1="nodeMap.get(edge.source)?.x"
              :y1="nodeMap.get(edge.source)?.y"
              :x2="nodeMap.get(edge.target)?.x"
              :y2="nodeMap.get(edge.target)?.y"
              :stroke="
                isEdgeHighlighted(edge.source, edge.target)
                  ? 'oklch(0.72 0.17 250 / 0.55)'
                  : 'oklch(0.75 0 0 / 0.13)'
              "
              :stroke-width="
                isEdgeHighlighted(edge.source, edge.target) ? 2 : 1.15
              "
            />
          </g>

          <g
            v-for="node in graphLayout.nodes"
            :key="node.id"
            class="cursor-pointer"
            @click.stop="openNoteInNotesWorkspace(node.id)"
            @mouseenter="activeNodeId = node.id"
          >
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="getNodeRadius(node.incomingLinksCount) + 10"
              :fill="
                isNodeHighlighted(node.id)
                  ? 'oklch(0.72 0.17 250 / 0.16)'
                  : 'oklch(0.72 0.17 250 / 0.05)'
              "
            />
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="getNodeRadius(node.incomingLinksCount)"
              :fill="
                activeNodeId === node.id
                  ? 'oklch(0.74 0.19 250)'
                  : node.incomingLinksCount > 0
                    ? 'oklch(0.71 0.12 250 / 0.92)'
                    : 'oklch(0.86 0.01 250 / 0.45)'
              "
              :stroke="
                isNodeHighlighted(node.id)
                  ? 'oklch(0.92 0.02 250 / 0.9)'
                  : 'oklch(0.92 0.01 250 / 0.16)'
              "
              :stroke-width="isNodeHighlighted(node.id) ? 1.8 : 1"
            />
            <text
              v-if="
                activeNodeId === node.id
                  || activeNeighborIds.has(node.id)
                  || node.incomingLinksCount >= 3
              "
              :x="node.x + getNodeRadius(node.incomingLinksCount) + 10"
              :y="node.y + 4"
              text-anchor="start"
              class="fill-foreground text-[12px] font-medium"
            >
              {{
                node.name.length > 28 ? `${node.name.slice(0, 28)}…` : node.name
              }}
            </text>
          </g>
        </g>
      </svg>

      <div
        class="bg-background/70 border-border absolute right-4 bottom-4 max-w-72 rounded-lg border px-3 py-2 backdrop-blur"
      >
        <div
          v-if="activeNodeId"
          class="space-y-1"
        >
          <div class="text-sm font-semibold">
            {{ nodeMap.get(activeNodeId)?.name }}
          </div>
          <div class="text-muted-foreground text-xs">
            {{
              i18n.t("notes.dashboard.graph.meta", {
                links: nodeMap.get(activeNodeId)?.incomingLinksCount ?? 0,
                neighbors: activeNeighborIds.size,
              })
            }}
          </div>
        </div>
        <div
          v-else
          class="text-muted-foreground text-xs"
        >
          {{ i18n.t("notes.dashboard.graph.hint") }}
        </div>
      </div>
    </div>
  </div>
</template>
