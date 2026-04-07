<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import type {
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from 'd3-force'
import { Button } from '@/components/ui/shadcn/button'
import { useNotesDashboard, useNotesWorkspaceNavigation } from '@/composables'
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
import { buildNotesGraphLayout, getNotesGraphBounds } from './notesGraphLayout'

const props = defineProps<{
  graphPreview: NotesDashboardResponse['graphPreview']
}>()

const PREVIEW_WIDTH = 560
const PREVIEW_HEIGHT = 240

interface PreviewNode extends SimulationNodeDatum {
  id: number
  incomingLinksCount: number
  name: string
  radius: number
  x: number
  y: number
  fx?: number | null
  fy?: number | null
}

interface PreviewLink extends SimulationLinkDatum<PreviewNode> {
  source: number | PreviewNode
  target: number | PreviewNode
}

interface PreviewLabel {
  id: number
  isActive: boolean
  text: string
  textAnchor: 'middle' | 'start'
  x: number
  y: number
}

const { navigateToGraph } = useNotesDashboard()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()

const previewSvgRef = ref<SVGSVGElement>()
const previewNodes = shallowRef<PreviewNode[]>([])
const hoveredNodeId = ref<number | null>(null)
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
const dragState = reactive({
  active: false,
  moved: false,
  nodeId: null as number | null,
  suppressClickUntil: 0,
})

let previewSimulation: Simulation<PreviewNode, PreviewLink> | null = null
let animationFrameId = 0

const seedGraph = computed(() => {
  const connectedIds = new Set<number>()

  props.graphPreview.edges.forEach((edge) => {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  })

  const prioritizedNodes = [...props.graphPreview.nodes]
    .sort((left, right) => {
      if (right.incomingLinksCount !== left.incomingLinksCount) {
        return right.incomingLinksCount - left.incomingLinksCount
      }

      return left.name.localeCompare(right.name)
    })
    .filter(node => connectedIds.has(node.id))
  const fallbackNodes = props.graphPreview.nodes.filter(
    node => !connectedIds.has(node.id),
  )
  const selectedNodes = [...prioritizedNodes, ...fallbackNodes].slice(0, 24)
  const selectedIds = new Set(selectedNodes.map(node => node.id))
  const selectedEdges = props.graphPreview.edges.filter(
    edge => selectedIds.has(edge.source) && selectedIds.has(edge.target),
  )

  return buildNotesGraphLayout(selectedNodes, selectedEdges, { compact: true })
})

const previewEdges = computed(() => seedGraph.value.edges)
const nodeMap = computed(
  () => new Map(previewNodes.value.map(node => [node.id, node])),
)
const graphBounds = computed(() => getNotesGraphBounds(previewNodes.value, 28))

const neighborIds = computed(() => {
  const neighbors = new Map<number, Set<number>>()

  previewNodes.value.forEach((node) => {
    neighbors.set(node.id, new Set())
  })

  previewEdges.value.forEach((edge) => {
    neighbors.get(edge.source)?.add(edge.target)
    neighbors.get(edge.target)?.add(edge.source)
  })

  return neighbors
})

const activeNeighborhoodIds = computed(() => {
  const ids = new Set<number>()

  if (!hoveredNodeId.value) {
    return ids
  }

  ids.add(hoveredNodeId.value)

  neighborIds.value.get(hoveredNodeId.value)?.forEach((neighborId) => {
    ids.add(neighborId)
  })

  return ids
})

const previewLabels = computed<PreviewLabel[]>(() => {
  if (!hoveredNodeId.value) {
    return []
  }

  const labels = previewNodes.value
    .filter(node => activeNeighborhoodIds.value.has(node.id))
    .sort((left, right) => {
      if (left.id === hoveredNodeId.value) {
        return -1
      }

      if (right.id === hoveredNodeId.value) {
        return 1
      }

      return right.incomingLinksCount - left.incomingLinksCount
    })
    .map((node) => {
      const isActive = node.id === hoveredNodeId.value
      const radius = getDisplayedNodeRadius(node)
      const text
        = node.name.length > 20 ? `${node.name.slice(0, 20)}…` : node.name

      return {
        id: node.id,
        isActive,
        text,
        textAnchor: isActive ? 'middle' : 'start',
        x: isActive
          ? node.x * zoom.value + pan.x
          : (node.x + radius + 6) * zoom.value + pan.x,
        y: isActive
          ? (node.y + radius + 13) * zoom.value + pan.y
          : (node.y + 3) * zoom.value + pan.y,
      }
    })

  const occupiedBoxes: Array<{
    bottom: number
    left: number
    right: number
    top: number
  }> = []

  return labels.filter((label) => {
    const fontSize = label.isActive ? 12 : 10
    const width = label.text.length * (label.isActive ? 6.2 : 5.6)
    const left = label.textAnchor === 'middle' ? label.x - width / 2 : label.x
    const right
      = label.textAnchor === 'middle' ? label.x + width / 2 : label.x + width
    const top = label.y - fontSize
    const bottom = label.y + 4
    const overlaps = occupiedBoxes.some(
      box =>
        left < box.right
        && right > box.left
        && top < box.bottom
        && bottom > box.top,
    )

    if (overlaps) {
      return false
    }

    occupiedBoxes.push({
      left: left - 3,
      right: right + 3,
      top: top - 2,
      bottom: bottom + 2,
    })

    return true
  })
})

function getPreviewNodeRadius(radius: number) {
  return Math.max(1.8, Math.min(4.8, radius * 0.64))
}

function getDisplayedNodeRadius(node: PreviewNode) {
  if (hoveredNodeId.value === node.id) {
    return node.radius + 1.8
  }

  if (neighborIds.value.get(hoveredNodeId.value ?? -1)?.has(node.id)) {
    return node.radius + 0.5
  }

  return node.radius
}

function resetViewport() {
  if (!previewNodes.value.length) {
    zoom.value = 1
    pan.x = 0
    pan.y = 0

    return
  }

  const fittedZoom = Math.min(
    1.1,
    Math.max(
      0.72,
      Math.min(
        PREVIEW_WIDTH / (graphBounds.value.width + 28),
        PREVIEW_HEIGHT / (graphBounds.value.height + 28),
      ),
    ),
  )

  zoom.value = Number(fittedZoom.toFixed(2))
  pan.x
    = (PREVIEW_WIDTH - graphBounds.value.width * zoom.value) / 2
      - graphBounds.value.minX * zoom.value
  pan.y
    = (PREVIEW_HEIGHT - graphBounds.value.height * zoom.value) / 2
      - graphBounds.value.minY * zoom.value
}

function getPointerPosition(event: PointerEvent | WheelEvent) {
  if (!previewSvgRef.value) {
    return null
  }

  const matrix = previewSvgRef.value.getScreenCTM()

  if (!matrix) {
    return null
  }

  const point = previewSvgRef.value.createSVGPoint()
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
  const nextZoom = Math.min(2.4, Math.max(0.58, Number(nextZoomValue)))
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

  const delta = event.deltaY > 0 ? 0.9 : 1.1
  applyZoom(zoom.value * delta, anchor)
}

function startPan(event: PointerEvent) {
  if (dragState.active || event.button !== 0) {
    return
  }

  hoveredNodeId.value = null
  panState.active = true
  panState.startX = event.clientX
  panState.startY = event.clientY
  panState.x = pan.x
  panState.y = pan.y

  previewSvgRef.value?.setPointerCapture(event.pointerId)
}

function openNode(nodeId: number) {
  if (Date.now() < dragState.suppressClickUntil) {
    return
  }

  void openNoteInNotesWorkspace(nodeId)
}

function moveInteraction(event: PointerEvent) {
  if (dragState.active) {
    const node = dragState.nodeId ? nodeMap.value.get(dragState.nodeId) : null
    const position = getGraphPosition(event)

    if (!node || !position) {
      return
    }

    node.fx = position.x
    node.fy = position.y
    node.x = position.x
    node.y = position.y
    dragState.moved = true
    triggerRef(previewNodes)

    return
  }

  if (!panState.active) {
    return
  }

  pan.x = panState.x + event.clientX - panState.startX
  pan.y = panState.y + event.clientY - panState.startY
}

function stopInteraction(event?: PointerEvent) {
  if (dragState.active && dragState.nodeId) {
    const node = nodeMap.value.get(dragState.nodeId)

    if (node) {
      node.fx = null
      node.fy = null
    }

    if (dragState.moved) {
      dragState.suppressClickUntil = Date.now() + 150
    }

    previewSimulation?.alphaTarget(0)
  }

  dragState.active = false
  dragState.moved = false
  dragState.nodeId = null
  panState.active = false

  if (event && previewSvgRef.value?.hasPointerCapture(event.pointerId)) {
    previewSvgRef.value.releasePointerCapture(event.pointerId)
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

  hoveredNodeId.value = nodeId
  dragState.active = true
  dragState.moved = false
  dragState.nodeId = nodeId
  panState.active = false
  node.fx = position.x
  node.fy = position.y
  node.x = position.x
  node.y = position.y

  previewSimulation?.alphaTarget(0.18).restart()
  triggerRef(previewNodes)
  previewSvgRef.value?.setPointerCapture(event.pointerId)
}

function schedulePreviewUpdate() {
  if (animationFrameId) {
    return
  }

  animationFrameId = window.requestAnimationFrame(() => {
    animationFrameId = 0
    triggerRef(previewNodes)
  })
}

function stopPreviewSimulation() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
  }

  previewSimulation?.on('tick', null)
  previewSimulation?.stop()
  previewSimulation = null
}

function initializePreviewSimulation() {
  stopPreviewSimulation()

  if (!seedGraph.value.nodes.length) {
    previewNodes.value = []

    return
  }

  const nodes = seedGraph.value.nodes.map(node => ({
    ...node,
    radius: getPreviewNodeRadius(node.radius),
    fx: null,
    fy: null,
  }))
  const links: PreviewLink[] = seedGraph.value.edges.map(edge => ({
    source: edge.source,
    target: edge.target,
  }))

  previewNodes.value = nodes
  triggerRef(previewNodes)

  previewSimulation = forceSimulation(nodes)
    .force(
      'charge',
      forceManyBody<PreviewNode>().strength(node => -14 - node.radius * 2.8),
    )
    .force(
      'collision',
      forceCollide<PreviewNode>()
        .radius(node => node.radius + 1.8)
        .strength(0.96),
    )
    .force(
      'link',
      forceLink<PreviewNode, PreviewLink>(links)
        .id(node => node.id)
        .distance(16)
        .strength(0.26),
    )
    .force(
      'center',
      forceCenter(seedGraph.value.width / 2, seedGraph.value.height / 2),
    )
    .force('x', forceX(seedGraph.value.width / 2).strength(0.035))
    .force('y', forceY(seedGraph.value.height / 2).strength(0.035))
    .alpha(0.7)
    .alphaDecay(0.06)
    .velocityDecay(0.32)
    .on('tick', schedulePreviewUpdate)

  nextTick(() => {
    resetViewport()
  })
}

function isNodeHighlighted(nodeId: number) {
  if (!hoveredNodeId.value) {
    return false
  }

  return (
    nodeId === hoveredNodeId.value || activeNeighborhoodIds.value.has(nodeId)
  )
}

function isNodeDimmed(nodeId: number) {
  if (!hoveredNodeId.value) {
    return false
  }

  return !activeNeighborhoodIds.value.has(nodeId)
}

function isEdgeHighlighted(source: number, target: number) {
  if (!hoveredNodeId.value) {
    return false
  }

  return source === hoveredNodeId.value || target === hoveredNodeId.value
}

function isEdgeDimmed(source: number, target: number) {
  if (!hoveredNodeId.value) {
    return false
  }

  return !isEdgeHighlighted(source, target)
}

onBeforeUnmount(() => {
  stopPreviewSimulation()
})

watch(
  seedGraph,
  () => {
    initializePreviewSimulation()
  },
  { immediate: true },
)
</script>

<template>
  <NotesDashboardSection :title="i18n.t('notes.dashboard.graphPreview.title')">
    <template #actions>
      <Button
        size="sm"
        variant="ghost"
        @click="navigateToGraph"
      >
        {{ i18n.t("notes.dashboard.actions.openGraph") }}
      </Button>
    </template>
    <div
      v-if="previewNodes.length"
      class="overflow-hidden rounded-lg border bg-[#1e1e1e]"
    >
      <svg
        ref="previewSvgRef"
        class="block h-72 w-full touch-none select-none"
        :class="{
          'cursor-grabbing': panState.active || dragState.active,
          'cursor-grab': !panState.active && !dragState.active,
        }"
        :viewBox="`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`"
        preserveAspectRatio="xMidYMid meet"
        @mouseleave="stopInteraction"
        @pointermove="moveInteraction"
        @pointerup="stopInteraction"
        @pointercancel="stopInteraction"
        @wheel.prevent="onWheel"
        @pointerdown="startPan"
      >
        <g :transform="`translate(${pan.x}, ${pan.y}) scale(${zoom})`">
          <g>
            <line
              v-for="edge in previewEdges"
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
                    : 'rgba(210,210,210,0.14)'
              "
              :stroke-width="
                isEdgeHighlighted(edge.source, edge.target) ? 0.95 : 0.5
              "
            />
          </g>

          <g
            v-for="node in previewNodes"
            :key="node.id"
            class="cursor-pointer"
            @click.stop="openNode(node.id)"
            @mouseenter="hoveredNodeId = node.id"
          >
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="getDisplayedNodeRadius(node) + 1.8"
              :fill="
                hoveredNodeId === node.id
                  ? 'rgba(139,92,246,0.22)'
                  : neighborIds.get(hoveredNodeId ?? -1)?.has(node.id)
                    ? 'rgba(139,92,246,0.08)'
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
                hoveredNodeId === node.id
                  ? 'rgba(139,92,246,0.98)'
                  : neighborIds.get(hoveredNodeId ?? -1)?.has(node.id)
                    ? 'rgba(238,238,238,0.92)'
                    : isNodeDimmed(node.id)
                      ? 'rgba(140,140,140,0.34)'
                      : node.incomingLinksCount > 0
                        ? 'rgba(188,188,188,0.6)'
                        : 'rgba(158,158,158,0.5)'
              "
              :stroke="
                isNodeHighlighted(node.id)
                  ? 'rgba(255,255,255,0.4)'
                  : 'rgba(255,255,255,0.06)'
              "
              :stroke-width="isNodeHighlighted(node.id) ? 0.55 : 0.2"
              @pointerdown.stop="startNodeDrag(node.id, $event)"
            />
          </g>
        </g>

        <g class="pointer-events-none">
          <text
            v-for="label in previewLabels"
            :key="label.id"
            :x="label.x"
            :y="label.y"
            :text-anchor="label.textAnchor"
            :class="
              label.isActive
                ? 'fill-white text-[12px] font-medium'
                : 'fill-white/38 text-[10px]'
            "
          >
            {{ label.text }}
          </text>
        </g>
      </svg>
      <div
        class="border-border/60 flex items-center justify-between border-t px-3 py-2 text-xs text-white/55"
      >
        <span>{{ i18n.t("notes.dashboard.graphPreview.caption") }}</span>
        <span>
          {{ previewNodes.length }} / {{ props.graphPreview.nodes.length }}
        </span>
      </div>
    </div>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('notes.dashboard.graphPreview.empty')"
    />
  </NotesDashboardSection>
</template>
