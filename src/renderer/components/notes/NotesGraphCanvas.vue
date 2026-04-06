<script setup lang="ts">
import type {
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from 'd3-force'
import { Button } from '@/components/ui/shadcn/button'
import { useNotesGraph, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'
import {
  ArrowLeft,
  LoaderCircle,
  LocateFixed,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
import { buildNotesGraphLayout, getNotesGraphBounds } from './notesGraphLayout'

const VIEWBOX_WIDTH = 1000
const VIEWBOX_HEIGHT = 720

interface ForceGraphNode extends SimulationNodeDatum {
  id: number
  incomingLinksCount: number
  name: string
  radius: number
  x: number
  y: number
  fx?: number | null
  fy?: number | null
}

interface ForceGraphLink extends SimulationLinkDatum<ForceGraphNode> {
  source: number | ForceGraphNode
  target: number | ForceGraphNode
}

const {
  graphData,
  graphError,
  isGraphLoading,
  getNotesGraph,
  navigateBackToDashboard,
} = useNotesGraph()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()

const graphSvgRef = ref<SVGSVGElement>()
const graphNodes = shallowRef<ForceGraphNode[]>([])
const activeNodeId = ref<number | null>(null)
const zoom = ref(1)
const pan = reactive({
  x: 0,
  y: 0,
})
const panState = reactive({
  active: false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
})
const nodeDragState = reactive({
  active: false,
  moved: false,
  nodeId: null as number | null,
  suppressClickUntil: 0,
})

let graphSimulation: Simulation<ForceGraphNode, ForceGraphLink> | null = null
let animationFrameId = 0

const graphEdges = computed(() => graphData.value?.edges ?? [])
const nodeMap = computed(
  () => new Map(graphNodes.value.map(node => [node.id, node])),
)
const graphBounds = computed(() => getNotesGraphBounds(graphNodes.value, 56))

const neighborsById = computed(() => {
  const neighbors = new Map<number, Set<number>>()

  graphNodes.value.forEach((node) => {
    neighbors.set(node.id, new Set())
  })

  graphEdges.value.forEach((edge) => {
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

const activeNeighborhoodIds = computed(() => {
  const ids = new Set<number>()

  if (!activeNodeId.value) {
    return ids
  }

  ids.add(activeNodeId.value)

  activeNeighborIds.value.forEach((neighborId) => {
    ids.add(neighborId)
  })

  return ids
})

function resetViewport() {
  if (!graphNodes.value.length) {
    zoom.value = 1
    pan.x = 0
    pan.y = 0

    return
  }

  const fittedZoom = Math.min(
    1.28,
    Math.max(
      0.42,
      Math.min(
        VIEWBOX_WIDTH / (graphBounds.value.width + 80),
        VIEWBOX_HEIGHT / (graphBounds.value.height + 80),
      ),
    ),
  )

  zoom.value = Number(fittedZoom.toFixed(2))
  pan.x
    = (VIEWBOX_WIDTH - graphBounds.value.width * zoom.value) / 2
      - graphBounds.value.minX * zoom.value
  pan.y
    = (VIEWBOX_HEIGHT - graphBounds.value.height * zoom.value) / 2
      - graphBounds.value.minY * zoom.value
}

function zoomIn() {
  applyZoom((zoom.value + 0.12).toFixed(2), {
    x: VIEWBOX_WIDTH / 2,
    y: VIEWBOX_HEIGHT / 2,
  })
}

function zoomOut() {
  applyZoom((zoom.value - 0.12).toFixed(2), {
    x: VIEWBOX_WIDTH / 2,
    y: VIEWBOX_HEIGHT / 2,
  })
}

function getPointerPosition(event: PointerEvent | WheelEvent) {
  if (!graphSvgRef.value) {
    return null
  }

  const matrix = graphSvgRef.value.getScreenCTM()

  if (!matrix) {
    return null
  }

  const point = graphSvgRef.value.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY

  const svgPoint = point.matrixTransform(matrix.inverse())

  return {
    x: svgPoint.x,
    y: svgPoint.y,
  }
}

function getGraphPosition(event: PointerEvent | WheelEvent) {
  const pointer = getPointerPosition(event)

  if (!pointer) {
    return null
  }

  return {
    x: (pointer.x - pan.x) / zoom.value,
    y: (pointer.y - pan.y) / zoom.value,
  }
}

function applyZoom(
  nextZoomValue: string | number,
  anchor: { x: number, y: number },
) {
  const nextZoom = Math.min(2.8, Math.max(0.35, Number(nextZoomValue)))
  const graphX = (anchor.x - pan.x) / zoom.value
  const graphY = (anchor.y - pan.y) / zoom.value

  zoom.value = Number(nextZoom.toFixed(2))
  pan.x = anchor.x - graphX * zoom.value
  pan.y = anchor.y - graphY * zoom.value
}

function onWheel(event: WheelEvent) {
  const anchor = getPointerPosition(event)

  if (!anchor) {
    return
  }

  const delta = event.deltaY > 0 ? 0.88 : 1.12
  applyZoom(zoom.value * delta, anchor)
}

function startPan(event: PointerEvent) {
  if (nodeDragState.active || event.button !== 0) {
    return
  }

  activeNodeId.value = null
  panState.active = true
  panState.startX = event.clientX
  panState.startY = event.clientY
  panState.x = pan.x
  panState.y = pan.y

  graphSvgRef.value?.setPointerCapture(event.pointerId)
}

function openNode(nodeId: number) {
  if (Date.now() < nodeDragState.suppressClickUntil) {
    return
  }

  void openNoteInNotesWorkspace(nodeId)
}

function movePan(event: PointerEvent) {
  if (nodeDragState.active) {
    const node = nodeDragState.nodeId
      ? nodeMap.value.get(nodeDragState.nodeId)
      : null
    const position = getGraphPosition(event)

    if (!node || !position) {
      return
    }

    node.fx = position.x
    node.fy = position.y
    node.x = position.x
    node.y = position.y
    nodeDragState.moved = true
    triggerRef(graphNodes)

    return
  }

  if (!panState.active) {
    return
  }

  pan.x = panState.x + event.clientX - panState.startX
  pan.y = panState.y + event.clientY - panState.startY
}

function stopInteraction(event?: PointerEvent) {
  if (nodeDragState.active && nodeDragState.nodeId) {
    const node = nodeMap.value.get(nodeDragState.nodeId)

    if (node) {
      node.fx = null
      node.fy = null
    }

    if (nodeDragState.moved) {
      nodeDragState.suppressClickUntil = Date.now() + 150
    }

    nodeDragState.active = false
    nodeDragState.moved = false
    nodeDragState.nodeId = null
    graphSimulation?.alphaTarget(0)
  }

  panState.active = false

  if (event && graphSvgRef.value?.hasPointerCapture(event.pointerId)) {
    graphSvgRef.value.releasePointerCapture(event.pointerId)
  }
}

function startNodeDrag(nodeId: number, event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  const node = nodeMap.value.get(nodeId)
  const position = getGraphPosition(event)

  if (!node || !position) {
    return
  }

  activeNodeId.value = nodeId
  nodeDragState.active = true
  nodeDragState.moved = false
  nodeDragState.nodeId = nodeId
  panState.active = false
  node.fx = position.x
  node.fy = position.y
  node.x = position.x
  node.y = position.y

  graphSimulation?.alphaTarget(0.22).restart()
  triggerRef(graphNodes)
  graphSvgRef.value?.setPointerCapture(event.pointerId)
}

function isNodeHighlighted(nodeId: number) {
  if (!activeNodeId.value) {
    return false
  }

  return nodeId === activeNodeId.value || activeNeighborIds.value.has(nodeId)
}

function isNodeDimmed(nodeId: number) {
  if (!activeNodeId.value) {
    return false
  }

  return !activeNeighborhoodIds.value.has(nodeId)
}

function isEdgeHighlighted(source: number, target: number) {
  if (!activeNodeId.value) {
    return false
  }

  return source === activeNodeId.value || target === activeNodeId.value
}

function isEdgeDimmed(source: number, target: number) {
  if (!activeNodeId.value) {
    return false
  }

  return !isEdgeHighlighted(source, target)
}

function getDisplayedNodeRadius(node: ForceGraphNode) {
  if (activeNodeId.value === node.id) {
    return node.radius + 2.4
  }

  if (activeNeighborIds.value.has(node.id)) {
    return node.radius + 0.8
  }

  return node.radius
}

function scheduleGraphUpdate() {
  if (animationFrameId) {
    return
  }

  animationFrameId = window.requestAnimationFrame(() => {
    animationFrameId = 0
    triggerRef(graphNodes)
  })
}

function stopSimulation() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
  }

  graphSimulation?.on('tick', null)
  graphSimulation?.stop()
  graphSimulation = null
}

function initializeSimulation() {
  stopSimulation()

  if (!graphData.value?.nodes.length) {
    graphNodes.value = []

    return
  }

  const seededLayout = buildNotesGraphLayout(
    graphData.value.nodes,
    graphData.value.edges,
  )

  const nodes = seededLayout.nodes.map(node => ({
    ...node,
    fx: null,
    fy: null,
  }))
  const links: ForceGraphLink[] = graphData.value.edges.map(edge => ({
    source: edge.source,
    target: edge.target,
  }))

  graphNodes.value = nodes
  triggerRef(graphNodes)

  graphSimulation = forceSimulation(nodes)
    .force(
      'charge',
      forceManyBody<ForceGraphNode>().strength(
        node => -54 - node.radius * 2.4 - node.incomingLinksCount * 2,
      ),
    )
    .force(
      'collision',
      forceCollide<ForceGraphNode>()
        .radius(node => node.radius + 4)
        .strength(0.95),
    )
    .force(
      'link',
      forceLink<ForceGraphNode, ForceGraphLink>(links)
        .id(node => node.id)
        .distance((link) => {
          const source
            = typeof link.source === 'object'
              ? link.source.incomingLinksCount
              : 0
          const target
            = typeof link.target === 'object'
              ? link.target.incomingLinksCount
              : 0

          return 34 + Math.min(26, (source + target) * 1.4)
        })
        .strength(0.16),
    )
    .force(
      'center',
      forceCenter(seededLayout.width / 2, seededLayout.height / 2),
    )
    .force('x', forceX(seededLayout.width / 2).strength(0.018))
    .force('y', forceY(seededLayout.height / 2).strength(0.018))
    .alpha(0.9)
    .alphaDecay(0.032)
    .velocityDecay(0.24)
    .on('tick', scheduleGraphUpdate)

  nextTick(() => {
    resetViewport()
  })
}

onMounted(() => {
  if (!graphData.value) {
    void getNotesGraph()
  }
})

onBeforeUnmount(() => {
  stopSimulation()
})

watch(
  () => graphData.value,
  () => {
    initializeSimulation()
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
      v-else-if="!graphNodes.length"
      :text="i18n.t('notes.dashboard.graph.empty')"
    />

    <div
      v-else
      class="relative flex-1 overflow-hidden bg-[#1e1e1e]"
      @pointerleave="stopInteraction"
      @pointermove="movePan"
      @pointerup="stopInteraction"
      @pointercancel="stopInteraction"
      @wheel.prevent="onWheel"
    >
      <svg
        ref="graphSvgRef"
        class="h-full w-full touch-none select-none"
        :class="{
          'cursor-grabbing': panState.active || nodeDragState.active,
          'cursor-grab': !panState.active && !nodeDragState.active,
        }"
        :viewBox="`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`"
        preserveAspectRatio="xMidYMid meet"
        @pointerdown="startPan"
      >
        <g :transform="`translate(${pan.x}, ${pan.y}) scale(${zoom})`">
          <g>
            <line
              v-for="edge in graphEdges"
              :key="`${edge.source}-${edge.target}`"
              :x1="nodeMap.get(edge.source)?.x"
              :y1="nodeMap.get(edge.source)?.y"
              :x2="nodeMap.get(edge.target)?.x"
              :y2="nodeMap.get(edge.target)?.y"
              :stroke="
                isEdgeHighlighted(edge.source, edge.target)
                  ? 'rgba(139,92,246,0.9)'
                  : isEdgeDimmed(edge.source, edge.target)
                    ? 'rgba(160,160,160,0.08)'
                    : 'rgba(208,208,208,0.14)'
              "
              :stroke-width="
                isEdgeHighlighted(edge.source, edge.target) ? 1.3 : 0.55
              "
            />
          </g>

          <g
            v-for="node in graphNodes"
            :key="node.id"
            class="cursor-pointer"
            @click.stop="openNode(node.id)"
            @mouseenter="activeNodeId = node.id"
          >
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="getDisplayedNodeRadius(node) + 5"
              :fill="
                activeNodeId === node.id
                  ? 'rgba(139,92,246,0.22)'
                  : activeNeighborIds.has(node.id)
                    ? 'rgba(139,92,246,0.1)'
                    : isNodeDimmed(node.id)
                      ? 'rgba(255,255,255,0.01)'
                      : 'rgba(255,255,255,0.02)'
              "
            />
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="getDisplayedNodeRadius(node)"
              :fill="
                activeNodeId === node.id
                  ? 'rgba(139,92,246,0.98)'
                  : activeNeighborIds.has(node.id)
                    ? 'rgba(238,238,238,0.92)'
                    : isNodeDimmed(node.id)
                      ? 'rgba(140,140,140,0.36)'
                      : node.incomingLinksCount > 0
                        ? 'rgba(168,168,168,0.52)'
                        : 'rgba(142,142,142,0.42)'
              "
              :stroke="
                activeNodeId === node.id
                  ? 'rgba(196,181,253,0.95)'
                  : activeNeighborIds.has(node.id)
                    ? 'rgba(255,255,255,0.55)'
                    : isNodeDimmed(node.id)
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(255,255,255,0.08)'
              "
              :stroke-width="isNodeHighlighted(node.id) ? 0.85 : 0.35"
              @pointerdown.stop="startNodeDrag(node.id, $event)"
            />
            <text
              v-if="activeNeighborhoodIds.has(node.id)"
              :x="
                activeNodeId === node.id
                  ? node.x
                  : node.x + getDisplayedNodeRadius(node) + 8
              "
              :y="
                activeNodeId === node.id
                  ? node.y + getDisplayedNodeRadius(node) + 18
                  : node.y + 3
              "
              :text-anchor="activeNodeId === node.id ? 'middle' : 'start'"
              :class="
                activeNodeId === node.id
                  ? 'fill-white text-[15px] font-medium'
                  : 'fill-white/70 text-[11px]'
              "
            >
              {{
                node.name.length > 26 ? `${node.name.slice(0, 26)}…` : node.name
              }}
            </text>
          </g>
        </g>
      </svg>

      <div
        class="pointer-events-none absolute right-4 bottom-4 text-[11px] text-white/55"
      >
        {{
          activeNodeId
            ? i18n.t("notes.dashboard.graph.meta", {
              links: nodeMap.get(activeNodeId)?.incomingLinksCount ?? 0,
              neighbors: activeNeighborIds.size,
            })
            : i18n.t("notes.dashboard.graph.hint")
        }}
      </div>
    </div>
  </div>
</template>
