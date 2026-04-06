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
      class="overflow-hidden rounded-lg border"
    >
      <svg
        class="block h-72 w-full bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.04),_transparent_55%)]"
        :viewBox="`0 0 ${previewGraph.width} ${previewGraph.height}`"
      >
        <line
          v-for="edge in previewGraph.edges"
          :key="`${edge.source}-${edge.target}`"
          :x1="previewGraph.nodes.find((node) => node.id === edge.source)?.x"
          :y1="previewGraph.nodes.find((node) => node.id === edge.source)?.y"
          :x2="previewGraph.nodes.find((node) => node.id === edge.target)?.x"
          :y2="previewGraph.nodes.find((node) => node.id === edge.target)?.y"
          stroke="currentColor"
          class="text-border"
          stroke-width="1.5"
        />
        <g
          v-for="node in previewGraph.nodes"
          :key="node.id"
          class="cursor-pointer"
          @click="openNoteInNotesWorkspace(node.id)"
        >
          <rect
            :x="node.x - node.width / 2"
            :y="node.y - node.height / 2"
            :width="node.width"
            :height="node.height"
            rx="10"
            class="fill-card stroke-border"
            stroke-width="1.5"
          />
          <text
            :x="node.x"
            :y="node.y + 4"
            text-anchor="middle"
            class="fill-foreground text-[11px] font-medium"
          >
            {{
              node.name.length > 16 ? `${node.name.slice(0, 16)}…` : node.name
            }}
          </text>
        </g>
      </svg>
    </div>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('notes.dashboard.graphPreview.empty')"
    />
  </NotesDashboardSection>
</template>
