<script setup lang="ts">
import { useDrawings } from '@/composables'
import { i18n } from '@/electron'

const {
  activeDrawing,
  activeDrawingContent,
  sceneRevision,
  imageExportRequest,
  saveDrawingContent,
} = useDrawings()

const canvasRef = ref<{ openImageExport: () => void } | null>(null)

watch(imageExportRequest, () => {
  canvasRef.value?.openImageExport()
})

function onCanvasChange(drawingId: string, content: string) {
  void saveDrawingContent(drawingId, content)
}
</script>

<template>
  <div class="h-full w-full overflow-hidden">
    <DrawingsExcalidrawCanvas
      v-if="activeDrawing && activeDrawingContent !== null"
      ref="canvasRef"
      :drawing-id="activeDrawing.id"
      :content="activeDrawingContent"
      :revision="sceneRevision"
      @change="onCanvasChange"
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
  </div>
</template>
