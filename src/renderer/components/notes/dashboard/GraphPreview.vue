<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import * as Card from '@/components/ui/shadcn/card'
import {
  useNotesDashboard,
  useNotesWorkspaceNavigation,
  useTheme,
} from '@/composables'
import { i18n } from '@/electron'
import { useElementSize } from '@vueuse/core'
import { Expand, LocateFixed } from 'lucide-vue-next'
import { getNotesGraphPalette } from '../shared/graphPalette'

interface GraphSceneExposed {
  resetViewport: () => void
}

const props = defineProps<{
  graphPreview: NotesDashboardResponse['graphPreview']
}>()

const { navigateToGraph } = useNotesDashboard()
const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()
const { isDark } = useTheme()
const graphSceneRef = ref<GraphSceneExposed | null>(null)
const graphViewportRef = ref<HTMLElement>()
const { width: graphViewportWidth, height: graphViewportHeight }
  = useElementSize(graphViewportRef)
const graphPalette = computed(() => getNotesGraphPalette(isDark.value))

const graphSceneSize = computed(() => ({
  width: Math.max(320, Math.round(graphViewportWidth.value || 0)),
  height: Math.max(220, Math.round(graphViewportHeight.value || 0)),
}))

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
  <Card.Card class="h-full">
    <Card.CardHeader class="border-b">
      <Card.CardTitle>
        {{ i18n.t("notes.dashboard.graphPreview.title") }}
      </Card.CardTitle>
    </Card.CardHeader>
    <Card.CardContent class="min-h-0 flex-1">
      <div
        v-if="previewGraph.nodes.length"
        class="relative overflow-hidden rounded-lg border"
        :style="{ backgroundColor: graphPalette.background }"
      >
        <div class="absolute top-3 right-3 z-10 flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            @click="navigateToGraph"
          >
            <Expand />
          </Button>
          <Button
            size="icon"
            variant="outline"
            @click="graphSceneRef?.resetViewport()"
          >
            <LocateFixed />
          </Button>
        </div>
        <div
          ref="graphViewportRef"
          class="h-64 xl:h-[22rem]"
        >
          <NotesGraphScene
            ref="graphSceneRef"
            compact
            :nodes="previewGraph.nodes"
            :edges="previewGraph.edges"
            :width="graphSceneSize.width"
            :height="graphSceneSize.height"
            @node-click="openNoteInNotesWorkspace"
          />
        </div>
      </div>
      <UiEmptyPlaceholder
        v-else
        :text="i18n.t('notes.dashboard.graphPreview.empty')"
      />
    </Card.CardContent>
  </Card.Card>
</template>
