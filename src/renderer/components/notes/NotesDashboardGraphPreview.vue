<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import { useNotesDashboard, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import { Sparkles } from 'lucide-vue-next'
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
  const selectedNodes = [...prioritizedNodes, ...fallbackNodes].slice(0, 18)
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

function getNodeRadius(incomingLinksCount: number) {
  return Math.min(11, 3.5 + incomingLinksCount * 1.2)
}

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
      class="from-background via-background to-primary/8 overflow-hidden rounded-lg border bg-gradient-to-br bg-radial-[at_20%_20%]"
    >
      <svg
        class="block h-72 w-full"
        :viewBox="`0 0 ${previewGraph.width} ${previewGraph.height}`"
        @mouseleave="hoveredNodeId = null"
      >
        <g opacity="0.85">
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
                ? 'oklch(0.72 0.17 250 / 0.45)'
                : 'oklch(0.72 0 0 / 0.12)'
            "
            stroke-width="1.2"
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
            :r="getNodeRadius(node.incomingLinksCount) + 5"
            :fill="
              isNodeHighlighted(node.id)
                ? 'oklch(0.72 0.17 250 / 0.16)'
                : 'oklch(0.72 0.1 250 / 0.05)'
            "
          />
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="getNodeRadius(node.incomingLinksCount)"
            :fill="
              hoveredNodeId === node.id
                ? 'oklch(0.72 0.17 250)'
                : node.incomingLinksCount > 0
                  ? 'oklch(0.7 0.12 250 / 0.82)'
                  : 'oklch(0.82 0.01 250 / 0.48)'
            "
          />
          <text
            v-if="hoveredNodeId === node.id"
            :x="node.x"
            :y="node.y - getNodeRadius(node.incomingLinksCount) - 10"
            text-anchor="middle"
            class="fill-foreground text-[11px] font-medium"
          >
            {{
              node.name.length > 22 ? `${node.name.slice(0, 22)}…` : node.name
            }}
          </text>
        </g>

        <g opacity="0.55">
          <circle
            v-for="node in previewGraph.nodes.filter(
              (node) => node.incomingLinksCount > 1,
            )"
            :key="`pulse-${node.id}`"
            :cx="node.x"
            :cy="node.y"
            :r="getNodeRadius(node.incomingLinksCount) + 10"
            fill="none"
            stroke="oklch(0.72 0.17 250 / 0.12)"
            stroke-width="1"
          />
        </g>
      </svg>
      <div
        class="border-border/60 text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs"
      >
        <div class="flex items-center gap-2">
          <Sparkles class="h-3.5 w-3.5" />
          {{ i18n.t("notes.dashboard.graphPreview.caption") }}
        </div>
        <div>
          {{ previewGraph.nodes.length }} /
          {{ props.graphPreview.nodes.length }}
        </div>
      </div>
    </div>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('notes.dashboard.graphPreview.empty')"
    />
  </NotesDashboardSection>
</template>
