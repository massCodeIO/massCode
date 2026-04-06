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
import { buildNotesGraphLayout } from './notesGraphLayout'

const props = defineProps<{
  graphPreview: NotesDashboardResponse['graphPreview']
}>()

const PREVIEW_WIDTH = 560
const PREVIEW_HEIGHT = 240
const PREVIEW_PADDING = 16

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

const { navigateToGraph } = useNotesDashboard()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()

const previewSvgRef = ref<SVGSVGElement>()
const previewNodes = shallowRef<PreviewNode[]>([])
const hoveredNodeId = ref<number | null>(null)
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

function getPreviewNodeRadius(radius: number) {
  return Math.max(1.8, Math.min(4.8, radius * 0.64))
}

function getPointerPosition(event: PointerEvent) {
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

  const scale = Math.min(
    (PREVIEW_WIDTH - PREVIEW_PADDING * 2) / seedGraph.value.width,
    (PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / seedGraph.value.height,
  )
  const offsetX = (PREVIEW_WIDTH - seedGraph.value.width * scale) / 2
  const offsetY = (PREVIEW_HEIGHT - seedGraph.value.height * scale) / 2
  const nodes = seedGraph.value.nodes.map(node => ({
    ...node,
    radius: getPreviewNodeRadius(node.radius),
    x: node.x * scale + offsetX,
    y: node.y * scale + offsetY,
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
    .force('center', forceCenter(PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2))
    .force('x', forceX(PREVIEW_WIDTH / 2).strength(0.035))
    .force('y', forceY(PREVIEW_HEIGHT / 2).strength(0.035))
    .alpha(0.7)
    .alphaDecay(0.06)
    .velocityDecay(0.32)
    .on('tick', schedulePreviewUpdate)
}

function isNodeDimmed(nodeId: number) {
  if (!hoveredNodeId.value) {
    return false
  }

  return !activeNeighborhoodIds.value.has(nodeId)
}

function isEdgeDimmed(source: number, target: number) {
  if (!hoveredNodeId.value) {
    return false
  }

  return source !== hoveredNodeId.value && target !== hoveredNodeId.value
}

function openNode(nodeId: number) {
  if (Date.now() < dragState.suppressClickUntil) {
    return
  }

  void openNoteInNotesWorkspace(nodeId)
}

function startNodeDrag(nodeId: number, event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  const node = nodeMap.value.get(nodeId)
  const position = getPointerPosition(event)

  if (!node || !position) {
    return
  }

  hoveredNodeId.value = nodeId
  dragState.active = true
  dragState.moved = false
  dragState.nodeId = nodeId
  node.fx = position.x
  node.fy = position.y
  node.x = position.x
  node.y = position.y

  previewSimulation?.alphaTarget(0.18).restart()
  triggerRef(previewNodes)
  previewSvgRef.value?.setPointerCapture(event.pointerId)
}

function moveNode(event: PointerEvent) {
  if (!dragState.active || !dragState.nodeId) {
    return
  }

  const node = nodeMap.value.get(dragState.nodeId)
  const position = getPointerPosition(event)

  if (!node || !position) {
    return
  }

  node.fx = position.x
  node.fy = position.y
  node.x = position.x
  node.y = position.y
  dragState.moved = true
  triggerRef(previewNodes)
}

function stopNodeDrag(event?: PointerEvent) {
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

  if (event && previewSvgRef.value?.hasPointerCapture(event.pointerId)) {
    previewSvgRef.value.releasePointerCapture(event.pointerId)
  }
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
        class="block h-72 w-full select-none"
        :viewBox="`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`"
        preserveAspectRatio="xMidYMid meet"
        @mouseleave="hoveredNodeId = null"
        @pointermove="moveNode"
        @pointerup="stopNodeDrag"
        @pointercancel="stopNodeDrag"
      >
        <g>
          <line
            v-for="edge in previewEdges"
            :key="`${edge.source}-${edge.target}`"
            :x1="nodeMap.get(edge.source)?.x"
            :y1="nodeMap.get(edge.source)?.y"
            :x2="nodeMap.get(edge.target)?.x"
            :y2="nodeMap.get(edge.target)?.y"
            :stroke="
              hoveredNodeId
                && (edge.source === hoveredNodeId
                  || edge.target === hoveredNodeId
                  || neighborIds.get(hoveredNodeId)?.has(edge.source)
                  || neighborIds.get(hoveredNodeId)?.has(edge.target))
                ? 'rgba(139,92,246,0.9)'
                : isEdgeDimmed(edge.source, edge.target)
                  ? 'rgba(160,160,160,0.08)'
                  : 'rgba(210,210,210,0.14)'
            "
            :stroke-width="
              hoveredNodeId
                && (edge.source === hoveredNodeId || edge.target === hoveredNodeId)
                ? 0.95
                : 0.5
            "
          />
        </g>

        <g
          v-for="node in previewNodes"
          :key="node.id"
          class="cursor-pointer"
          @click="openNode(node.id)"
          @mouseenter="hoveredNodeId = node.id"
        >
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="node.radius + 1.8"
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
            :r="node.radius"
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
            @pointerdown.stop="startNodeDrag(node.id, $event)"
          />
          <text
            v-if="activeNeighborhoodIds.has(node.id)"
            :x="hoveredNodeId === node.id ? node.x : node.x + node.radius + 5"
            :y="
              hoveredNodeId === node.id ? node.y + node.radius + 14 : node.y + 3
            "
            :text-anchor="hoveredNodeId === node.id ? 'middle' : 'start'"
            :class="
              hoveredNodeId === node.id
                ? 'fill-white text-[12px] font-medium'
                : 'fill-white/70 text-[10px]'
            "
          >
            {{
              node.name.length > 22 ? `${node.name.slice(0, 22)}…` : node.name
            }}
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
