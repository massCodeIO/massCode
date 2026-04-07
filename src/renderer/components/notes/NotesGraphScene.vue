<script setup lang="ts">
import type {
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from 'd3-force'
import { useTheme } from '@/composables'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'
import { getNotesGraphPalette } from './notesDashboardPalette'
import { buildNotesGraphLayout, getNotesGraphBounds } from './notesGraphLayout'
import {
  buildGraphSceneLabels,
  getGraphSceneDisplayedNodeRadius,
  getGraphSceneNeighborhoodIds,
} from './notesGraphScene'

interface GraphSceneNodeInput {
  id: number
  incomingLinksCount: number
  name: string
}

interface GraphSceneEdgeInput {
  source: number
  target: number
}

interface SceneNode extends SimulationNodeDatum {
  id: number
  incomingLinksCount: number
  name: string
  radius: number
  x: number
  y: number
  fx?: number | null
  fy?: number | null
}

interface SceneLink extends SimulationLinkDatum<SceneNode> {
  source: number | SceneNode
  target: number | SceneNode
}

const props = withDefaults(
  defineProps<{
    compact?: boolean
    edges: GraphSceneEdgeInput[]
    height: number
    nodes: GraphSceneNodeInput[]
    width: number
  }>(),
  {
    compact: false,
  },
)

const emit = defineEmits<{
  nodeClick: [nodeId: number]
}>()

const sceneSvgRef = ref<SVGSVGElement>()
const sceneNodes = shallowRef<SceneNode[]>([])
const activeNodeId = ref<number | null>(null)
const { isDark } = useTheme()
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

let sceneSimulation: Simulation<SceneNode, SceneLink> | null = null
let animationFrameId = 0

const nodeMap = computed(
  () => new Map(sceneNodes.value.map(node => [node.id, node])),
)
const graphBounds = computed(() =>
  getNotesGraphBounds(sceneNodes.value, props.compact ? 28 : 56),
)

const neighborsById = computed(() => {
  const neighbors = new Map<number, Set<number>>()

  sceneNodes.value.forEach((node) => {
    neighbors.set(node.id, new Set())
  })

  props.edges.forEach((edge) => {
    neighbors.get(edge.source)?.add(edge.target)
    neighbors.get(edge.target)?.add(edge.source)
  })

  return neighbors
})

const activeNeighborIds = computed(() =>
  activeNodeId.value
    ? (neighborsById.value.get(activeNodeId.value) ?? new Set<number>())
    : new Set<number>(),
)

const activeNeighborhoodIds = computed(() =>
  getGraphSceneNeighborhoodIds(activeNodeId.value, neighborsById.value),
)

const sceneLabels = computed(() =>
  buildGraphSceneLabels({
    activeId: activeNodeId.value,
    compact: props.compact,
    neighborIds: activeNeighborIds.value,
    nodes: sceneNodes.value,
    pan,
    zoom: zoom.value,
  }),
)

const activeNode = computed(() =>
  activeNodeId.value ? (nodeMap.value.get(activeNodeId.value) ?? null) : null,
)
const graphPalette = computed(() => getNotesGraphPalette(isDark.value))

function getDisplayedNodeRadius(node: SceneNode) {
  return getGraphSceneDisplayedNodeRadius(
    node.radius,
    node.id,
    activeNodeId.value,
    activeNeighborIds.value,
    props.compact,
  )
}

function getEdgeStroke(source: number, target: number) {
  if (isEdgeHighlighted(source, target)) {
    return graphPalette.value.edgeActive
  }

  if (isEdgeDimmed(source, target)) {
    return graphPalette.value.edgeDimmed
  }

  return graphPalette.value.edgeBase
}

function getNodeHaloFill(nodeId: number) {
  if (activeNodeId.value === nodeId) {
    return graphPalette.value.nodeHaloActive
  }

  if (activeNeighborIds.value.has(nodeId)) {
    return graphPalette.value.nodeHaloNeighbor
  }

  if (isNodeDimmed(nodeId)) {
    return graphPalette.value.nodeHaloDimmed
  }

  return graphPalette.value.nodeHaloBase
}

function getNodeFill(node: SceneNode) {
  if (activeNodeId.value === node.id) {
    return graphPalette.value.nodeFillActive
  }

  if (activeNeighborIds.value.has(node.id)) {
    return graphPalette.value.nodeFillNeighbor
  }

  if (isNodeDimmed(node.id)) {
    return graphPalette.value.nodeFillDimmed
  }

  return node.incomingLinksCount > 0
    ? graphPalette.value.nodeFillBaseLinked
    : graphPalette.value.nodeFillBaseOrphan
}

function getNodeStroke(nodeId: number) {
  if (activeNodeId.value === nodeId) {
    return graphPalette.value.nodeStrokeActive
  }

  if (activeNeighborIds.value.has(nodeId)) {
    return graphPalette.value.nodeStrokeNeighbor
  }

  if (isNodeDimmed(nodeId)) {
    return graphPalette.value.nodeStrokeDimmed
  }

  return graphPalette.value.nodeStrokeBase
}

function getLabelFill(isActive: boolean) {
  return isActive
    ? graphPalette.value.nodeLabelActive
    : graphPalette.value.nodeLabelMuted
}

function resetViewport() {
  if (!sceneNodes.value.length) {
    zoom.value = 1
    pan.x = 0
    pan.y = 0

    return
  }

  const fittedZoom = props.compact
    ? Math.min(
        1.1,
        Math.max(
          0.72,
          Math.min(
            props.width / (graphBounds.value.width + 28),
            props.height / (graphBounds.value.height + 28),
          ),
        ),
      )
    : Math.min(
        1.28,
        Math.max(
          0.42,
          Math.min(
            props.width / (graphBounds.value.width + 80),
            props.height / (graphBounds.value.height + 80),
          ),
        ),
      )

  zoom.value = Number(fittedZoom.toFixed(2))
  pan.x
    = (props.width - graphBounds.value.width * zoom.value) / 2
      - graphBounds.value.minX * zoom.value
  pan.y
    = (props.height - graphBounds.value.height * zoom.value) / 2
      - graphBounds.value.minY * zoom.value
}

function zoomIn() {
  applyZoom((zoom.value + (props.compact ? 0.1 : 0.12)).toFixed(2), {
    x: props.width / 2,
    y: props.height / 2,
  })
}

function zoomOut() {
  applyZoom((zoom.value - (props.compact ? 0.1 : 0.12)).toFixed(2), {
    x: props.width / 2,
    y: props.height / 2,
  })
}

function getPointerPosition(event: PointerEvent | WheelEvent) {
  if (!sceneSvgRef.value) {
    return null
  }

  const matrix = sceneSvgRef.value.getScreenCTM()

  if (!matrix) {
    return null
  }

  const point = sceneSvgRef.value.createSVGPoint()
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
  const nextZoom = props.compact
    ? Math.min(2.4, Math.max(0.58, Number(nextZoomValue)))
    : Math.min(2.8, Math.max(0.35, Number(nextZoomValue)))
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

  const delta
    = event.deltaY > 0
      ? props.compact
        ? 0.9
        : 0.88
      : props.compact
        ? 1.1
        : 1.12
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

  sceneSvgRef.value?.setPointerCapture(event.pointerId)
}

function openNode(nodeId: number) {
  if (Date.now() < nodeDragState.suppressClickUntil) {
    return
  }

  emit('nodeClick', nodeId)
}

function moveInteraction(event: PointerEvent) {
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
    triggerRef(sceneNodes)

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

    sceneSimulation?.alphaTarget(0)
  }

  nodeDragState.active = false
  nodeDragState.moved = false
  nodeDragState.nodeId = null
  panState.active = false

  if (event && sceneSvgRef.value?.hasPointerCapture(event.pointerId)) {
    sceneSvgRef.value.releasePointerCapture(event.pointerId)
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

  sceneSimulation?.alphaTarget(props.compact ? 0.18 : 0.22).restart()
  triggerRef(sceneNodes)
  sceneSvgRef.value?.setPointerCapture(event.pointerId)
}

function isNodeHighlighted(nodeId: number) {
  if (!activeNodeId.value) {
    return false
  }

  return (
    nodeId === activeNodeId.value || activeNeighborhoodIds.value.has(nodeId)
  )
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

function scheduleSceneUpdate() {
  if (animationFrameId) {
    return
  }

  animationFrameId = window.requestAnimationFrame(() => {
    animationFrameId = 0
    triggerRef(sceneNodes)
  })
}

function stopSimulation() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
  }

  sceneSimulation?.on('tick', null)
  sceneSimulation?.stop()
  sceneSimulation = null
}

function initializeSimulation() {
  stopSimulation()

  if (!props.nodes.length) {
    sceneNodes.value = []

    return
  }

  const seededLayout = buildNotesGraphLayout(props.nodes, props.edges, {
    compact: props.compact,
  })
  const nodes = seededLayout.nodes.map(node => ({
    ...node,
    fx: null,
    fy: null,
  }))
  const links: SceneLink[] = props.edges.map(edge => ({
    source: edge.source,
    target: edge.target,
  }))

  sceneNodes.value = nodes
  triggerRef(sceneNodes)

  sceneSimulation = forceSimulation<SceneNode>(nodes)
    .force(
      'charge',
      forceManyBody<SceneNode>().strength(
        props.compact
          ? node => -14 - node.radius * 2.8
          : node => -54 - node.radius * 2.4 - node.incomingLinksCount * 2,
      ),
    )
    .force(
      'collision',
      forceCollide<SceneNode>()
        .radius(node => node.radius + (props.compact ? 1.8 : 4))
        .strength(props.compact ? 0.96 : 0.95),
    )
    .force(
      'link',
      forceLink<SceneNode, SceneLink>(links)
        .id(node => node.id)
        .distance((link) => {
          if (props.compact) {
            return 16
          }

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
        .strength(props.compact ? 0.26 : 0.16),
    )
    .force(
      'center',
      forceCenter(seededLayout.width / 2, seededLayout.height / 2),
    )
    .force(
      'x',
      forceX(seededLayout.width / 2).strength(props.compact ? 0.035 : 0.018),
    )
    .force(
      'y',
      forceY(seededLayout.height / 2).strength(props.compact ? 0.035 : 0.018),
    )
    .alpha(props.compact ? 0.7 : 0.9)
    .alphaDecay(props.compact ? 0.06 : 0.032)
    .velocityDecay(props.compact ? 0.32 : 0.24)
    .on('tick', scheduleSceneUpdate)

  nextTick(() => {
    resetViewport()
  })
}

defineExpose({
  resetViewport,
  zoomIn,
  zoomOut,
})

onBeforeUnmount(() => {
  stopSimulation()
})

watch(
  [() => props.nodes, () => props.edges, () => props.compact],
  () => {
    initializeSimulation()
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative h-full w-full">
    <svg
      ref="sceneSvgRef"
      class="h-full w-full touch-none select-none"
      :class="{
        'cursor-grabbing': panState.active || nodeDragState.active,
        'cursor-grab': !panState.active && !nodeDragState.active,
      }"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      @pointerleave="stopInteraction"
      @pointermove="moveInteraction"
      @pointerup="stopInteraction"
      @pointercancel="stopInteraction"
      @wheel.prevent="onWheel"
      @pointerdown="startPan"
    >
      <g :transform="`translate(${pan.x}, ${pan.y}) scale(${zoom})`">
        <g>
          <line
            v-for="edge in edges"
            :key="`${edge.source}-${edge.target}`"
            :x1="nodeMap.get(edge.source)?.x"
            :y1="nodeMap.get(edge.source)?.y"
            :x2="nodeMap.get(edge.target)?.x"
            :y2="nodeMap.get(edge.target)?.y"
            :stroke="getEdgeStroke(edge.source, edge.target)"
            :stroke-width="
              isEdgeHighlighted(edge.source, edge.target)
                ? compact
                  ? 0.95
                  : 1.3
                : compact
                  ? 0.5
                  : 0.55
            "
          />
        </g>

        <g
          v-for="node in sceneNodes"
          :key="node.id"
          class="cursor-pointer"
          @click.stop="openNode(node.id)"
          @mouseenter="activeNodeId = node.id"
        >
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="getDisplayedNodeRadius(node) + (compact ? 1.8 : 5)"
            :fill="getNodeHaloFill(node.id)"
          />
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="getDisplayedNodeRadius(node)"
            :fill="getNodeFill(node)"
            :stroke="getNodeStroke(node.id)"
            :stroke-width="
              isNodeHighlighted(node.id)
                ? compact
                  ? 0.55
                  : 0.85
                : compact
                  ? 0.2
                  : 0.35
            "
            @pointerdown.stop="startNodeDrag(node.id, $event)"
          />
        </g>
      </g>

      <g class="pointer-events-none">
        <text
          v-for="label in sceneLabels"
          :key="label.id"
          :x="label.x"
          :y="label.y"
          :text-anchor="label.textAnchor"
          :fill="getLabelFill(label.isActive)"
          :class="
            label.isActive
              ? compact
                ? 'text-[12px] font-medium'
                : 'text-[15px] font-medium'
              : compact
                ? 'text-[10px]'
                : 'text-[11px]'
          "
        >
          {{ label.text }}
        </text>
      </g>
    </svg>

    <slot
      name="overlay"
      :active-node="activeNode"
      :neighbor-count="activeNeighborIds.size"
    />
  </div>
</template>
