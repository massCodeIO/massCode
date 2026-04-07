<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import { useNotesDashboard, useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'
import { LocateFixed } from 'lucide-vue-next'

interface GraphSceneExposed {
  resetViewport: () => void
}

const props = defineProps<{
  graphPreview: NotesDashboardResponse['graphPreview']
}>()

const { navigateToGraph } = useNotesDashboard()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()
const graphSceneRef = ref<GraphSceneExposed | null>(null)

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
  const nodes = [...prioritizedNodes, ...fallbackNodes].slice(0, 24)
  const ids = new Set(nodes.map(node => node.id))
  const edges = props.graphPreview.edges.filter(
    edge => ids.has(edge.source) && ids.has(edge.target),
  )

  return {
    edges,
    nodes,
  }
})
</script>

<template>
  <NotesDashboardSection :title="i18n.t('notes.dashboard.graphPreview.title')">
    <div
      v-if="previewGraph.nodes.length"
      class="relative overflow-hidden rounded-lg border bg-[#1e1e1e]"
    >
      <div class="absolute top-3 right-3 z-10 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          @click="navigateToGraph"
        >
          {{ i18n.t("notes.dashboard.actions.openGraph") }}
        </Button>
        <Button
          size="icon"
          variant="outline"
          @click="graphSceneRef?.resetViewport()"
        >
          <LocateFixed class="h-4 w-4" />
        </Button>
      </div>
      <div class="h-72">
        <NotesGraphScene
          ref="graphSceneRef"
          compact
          :nodes="previewGraph.nodes"
          :edges="previewGraph.edges"
          :width="560"
          :height="240"
          @node-click="openNoteInNotesWorkspace"
        />
      </div>
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
