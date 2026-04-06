<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import { useNotesDashboard, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import { buildNotesGraphLayout } from './notesGraphLayout'

const props = defineProps<{
  graphPreview: NotesDashboardResponse['graphPreview']
}>()

const { navigateToGraph } = useNotesDashboard()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()
const hoveredNodeId = ref<number | null>(null)

const previewGraph = computed(() => {
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
  const selectedNodes = [...prioritizedNodes, ...fallbackNodes].slice(0, 22)
  const selectedIds = new Set(selectedNodes.map(node => node.id))
  const selectedEdges = props.graphPreview.edges.filter(
    edge => selectedIds.has(edge.source) && selectedIds.has(edge.target),
  )

  return buildNotesGraphLayout(selectedNodes, selectedEdges, { compact: true })
})

const nodeMap = computed(
  () => new Map(previewGraph.value.nodes.map(node => [node.id, node])),
)

const neighborIds = computed(() => {
  const neighbors = new Map<number, Set<number>>()

  previewGraph.value.nodes.forEach((node) => {
    neighbors.set(node.id, new Set())
  })

  previewGraph.value.edges.forEach((edge) => {
    neighbors.get(edge.source)?.add(edge.target)
    neighbors.get(edge.target)?.add(edge.source)
  })

  return neighbors
})

function isNodeHighlighted(nodeId: number) {
  if (!hoveredNodeId.value) {
    return false
  }

  return (
    hoveredNodeId.value === nodeId
    || neighborIds.value.get(hoveredNodeId.value)?.has(nodeId)
  )
}
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
      v-if="previewGraph.nodes.length"
      class="overflow-hidden rounded-lg border bg-[#1e1e1e]"
    >
      <svg
        class="block h-72 w-full"
        :viewBox="`0 0 ${previewGraph.width} ${previewGraph.height}`"
        preserveAspectRatio="none"
        @mouseleave="hoveredNodeId = null"
      >
        <g>
          <line
            v-for="edge in previewGraph.edges"
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
                ? 'rgba(224,224,224,0.34)'
                : 'rgba(210,210,210,0.14)'
            "
            :stroke-width="
              hoveredNodeId
                && (edge.source === hoveredNodeId || edge.target === hoveredNodeId)
                ? 1
                : 0.6
            "
          />
        </g>

        <g
          v-for="node in previewGraph.nodes"
          :key="node.id"
          class="cursor-pointer"
          @click="openNoteInNotesWorkspace(node.id)"
          @mouseenter="hoveredNodeId = node.id"
        >
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="node.radius + 2.5"
            :fill="
              isNodeHighlighted(node.id)
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(255,255,255,0.02)'
            "
          />
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="node.radius"
            :fill="
              hoveredNodeId === node.id
                ? 'rgba(255,255,255,0.96)'
                : node.incomingLinksCount > 0
                  ? 'rgba(220,220,220,0.84)'
                  : 'rgba(188,188,188,0.78)'
            "
          />
          <text
            v-if="hoveredNodeId === node.id"
            :x="node.x + node.radius + 6"
            :y="node.y + 3"
            text-anchor="start"
            class="fill-white text-[10px]"
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
          {{ previewGraph.nodes.length }} /
          {{ props.graphPreview.nodes.length }}
        </span>
      </div>
    </div>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('notes.dashboard.graphPreview.empty')"
    />
  </NotesDashboardSection>
</template>
