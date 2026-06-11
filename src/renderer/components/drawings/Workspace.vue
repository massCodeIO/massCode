<script setup lang="ts">
import type { DrawingViewportState } from '~/main/store/types'
import { useDrawings, useNavigationHistory } from '@/composables'
import { i18n } from '@/electron'
import { navigateBack, navigateForward } from '@/ipc/listeners/deepLinks'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const {
  activeDrawing,
  activeDrawingContent,
  activeDrawingViewport,
  sceneRevision,
  imageExportRequest,
  saveDrawingContent,
  saveDrawingViewport,
} = useDrawings()
const { canGoBack, canGoForward } = useNavigationHistory()

const canvasRef = ref<{ openImageExport: () => void } | null>(null)
const isHistoryVisible = computed(() => canGoBack.value || canGoForward.value)

watch(imageExportRequest, () => {
  canvasRef.value?.openImageExport()
})

function onCanvasChange(drawingId: string, content: string) {
  void saveDrawingContent(drawingId, content)
}

function onCanvasViewportChange(
  drawingId: string,
  viewport: DrawingViewportState,
) {
  saveDrawingViewport(drawingId, viewport)
}

function onBackClick() {
  void navigateBack()
}

function onForwardClick() {
  void navigateForward()
}
</script>

<template>
  <div class="relative h-full w-full overflow-hidden">
    <DrawingsExcalidrawCanvas
      v-if="activeDrawing && activeDrawingContent !== null"
      ref="canvasRef"
      :drawing-id="activeDrawing.id"
      :content="activeDrawingContent"
      :viewport="activeDrawingViewport"
      :revision="sceneRevision"
      @change="onCanvasChange"
      @viewport-change="onCanvasViewportChange"
    />
    <div
      v-else
      class="flex h-full items-center justify-center"
    >
      <UiText
        variant="sm"
        muted
      >
        {{ i18n.t("spaces.drawings.noSelected") }}
      </UiText>
    </div>
    <div
      v-if="isHistoryVisible"
      class="border-border bg-card absolute top-4 left-4 z-10 flex items-center gap-0.5 rounded-lg border p-1 shadow-xs"
    >
      <UiActionButton
        :disabled="!canGoBack"
        :tooltip="i18n.t('menu:history.back')"
        @click="onBackClick"
      >
        <ChevronLeft class="h-3 w-3" />
      </UiActionButton>
      <UiActionButton
        :disabled="!canGoForward"
        :tooltip="i18n.t('menu:history.forward')"
        @click="onForwardClick"
      >
        <ChevronRight class="h-3 w-3" />
      </UiActionButton>
    </div>
  </div>
</template>
