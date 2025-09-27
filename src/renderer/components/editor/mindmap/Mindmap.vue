<script setup lang="ts">
import { useSnippets } from '@/composables'
import { i18n } from '@/electron'
import domToImage from 'dom-to-image'
import { FileDown, Maximize, Minus, Plus } from 'lucide-vue-next'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

const { selectedSnippetContent, selectedSnippet } = useSnippets()

const mindmapRef = useTemplateRef('mindmapRef')
const svgRef = useTemplateRef('svgRef')

const transformer = new Transformer()

let mm: Markmap | null = null

async function update() {
  const value = selectedSnippetContent.value?.value || '# Empty'

  const { root } = transformer.transform(value)

  if (mm) {
    await mm.setData(root)
    await mm.fit()
  }
}

function init() {
  mm = Markmap.create(svgRef.value!, {
    duration: 0,
    style: () => `
      .markmap-node div { color: var(--color-text); user-select: none; cursor: default; }
      .markmap-node circle { fill: var(--color-bg); }
    `,
  })
  svgRef.value?.addEventListener('dblclick', e => e.stopPropagation(), true)
  update()
}

function onZoom(type: 'zoomIn' | 'zoomOut' | 'fit') {
  if (!mm)
    return
  if (type === 'zoomIn') {
    mm.rescale(1.25)
  }

  if (type === 'zoomOut') {
    mm.rescale(0.8)
  }

  if (type === 'fit') {
    mm.fit()
  }
}

async function onSaveScreenshot(type: 'png' | 'svg' = 'png') {
  let data = ''

  if (!mm)
    return

  await mm.fit()

  if (type === 'png') {
    data = await domToImage.toPng(mindmapRef.value!)
  }

  if (type === 'svg') {
    data = await domToImage.toSvg(mindmapRef.value!)
  }

  const a = document.createElement('a')
  a.href = data
  a.download = `${selectedSnippet.value?.name} - ${selectedSnippetContent.value?.label}.${type}`
  a.click()
}

onMounted(() => {
  init()
})

watch(selectedSnippetContent, () => {
  update()
})
</script>

<template>
  <div>
    <EditorHeaderTool>
      <div class="flex w-full items-center justify-between px-2">
        <div>
          <UiActionButton
            :tooltip="i18n.t('button.zoomIn')"
            @click="onZoom('zoomIn')"
          >
            <Plus class="h-3 w-3" />
          </UiActionButton>
          <UiActionButton
            :tooltip="i18n.t('button.zoomOut')"
            @click="onZoom('zoomOut')"
          >
            <Minus class="h-3 w-3" />
          </UiActionButton>
          <UiActionButton
            :tooltip="i18n.t('button.fit')"
            @click="onZoom('fit')"
          >
            <Maximize class="h-3 w-3" />
          </UiActionButton>
        </div>
        <div>
          <UiActionButton
            type="iconText"
            :tooltip="`${i18n.t('button.saveAs')} PNG`"
            @click="onSaveScreenshot('png')"
          >
            <div class="flex items-center gap-1">
              PNG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
          <UiActionButton
            type="iconText"
            :tooltip="`${i18n.t('button.saveAs')} SVG`"
            @click="onSaveScreenshot('svg')"
          >
            <div class="flex items-center gap-1">
              SVG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
        </div>
      </div>
    </EditorHeaderTool>
    <div
      ref="mindmapRef"
      class="h-full cursor-grab"
    >
      <svg
        ref="svgRef"
        class="h-[calc(100%-var(--editor-tool-header-height))] w-full"
      />
    </div>
  </div>
</template>
