<script setup lang="ts">
import { useNotes } from '@/composables'
import { useNativeExportBridge } from '@/composables/ai/nativeBridges'
import { saveRenderedArtifact } from '@/composables/useRenderedArtifactExport'
import { i18n } from '@/electron'
import domToImage from 'dom-to-image'
import { FileDown, Maximize, Minus, Plus } from 'lucide-vue-next'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

const { selectedNote, selectedNoteRecordStatus } = useNotes()

const mindmapRef = useTemplateRef('mindmapRef')
const svgRef = useTemplateRef('svgRef')

const transformer = new Transformer()

let mm: Markmap | null = null

let renderRevision = 0
let rendered: { id: number, content: string } | undefined
let rendering = Promise.resolve()
function update() {
  const revision = ++renderRevision
  rendered = undefined
  const note = selectedNote.value
  if (
    !note
    || selectedNoteRecordStatus.value !== 'ready'
    || typeof note.content !== 'string'
  ) {
    return rendering
  }
  const snapshot = { id: note.id, content: note.content }
  rendering = rendering
    .then(async () => {
      if (revision !== renderRevision || !mm)
        return
      const { root } = transformer.transform(snapshot.content || '# Empty')
      await mm.setData(root)
      await mm.fit()
      if (revision === renderRevision)
        rendered = snapshot
    })
    .catch((error) => {
      console.error('[notes] Mindmap render failed', error)
    })
  return rendering
}

function init() {
  mm = Markmap.create(svgRef.value!, {
    duration: 0,
    style: () => `
      .markmap-node div { color: var(--foreground); user-select: none; cursor: default; }
      .markmap-node circle { fill: var(--background); }
    `,
  })
  svgRef.value?.addEventListener('dblclick', e => e.stopPropagation(), true)
  void update()
}

async function onZoom(type: 'zoomIn' | 'zoomOut' | 'fit') {
  if (!mm)
    return
  if (type === 'zoomIn') {
    await mm.rescale(1.25)
  }

  if (type === 'zoomOut') {
    await mm.rescale(0.8)
  }

  if (type === 'fit') {
    await mm.fit()
  }
}

async function onSaveScreenshot(
  type: 'png' | 'svg' = 'png',
  current: () => boolean = () => true,
) {
  const note = selectedNote.value
  if (
    !note
    || !mm
    || selectedNoteRecordStatus.value !== 'ready'
    || typeof note.content !== 'string'
  ) {
    return { status: 'stale' as const }
  }
  const content = note.content
  await rendering
  const renderedVersion = rendered
  if (
    !current()
    || renderedVersion?.id !== note.id
    || renderedVersion.content !== content
  ) {
    return { status: 'stale' as const }
  }
  return saveRenderedArtifact(
    type,
    note.name,
    async () => {
      let data = ''

      await mm!.fit()

      if (type === 'png') {
        data = await domToImage.toPng(mindmapRef.value!)
      }

      if (type === 'svg') {
        data = await domToImage.toSvg(mindmapRef.value!)
      }

      return data
    },
    () =>
      current()
      && rendered === renderedVersion
      && selectedNoteRecordStatus.value === 'ready'
      && selectedNote.value?.id === note.id
      && selectedNote.value?.content === content,
  )
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  renderRevision++
  rendered = undefined
  mm?.destroy()
  mm = null
})

// Контент приходит позже id (полная запись загружается отдельно),
// поэтому отслеживаются оба: карта обновится, когда контент будет готов.
watch(
  () => [
    selectedNote.value?.id,
    selectedNote.value?.content,
    selectedNoteRecordStatus.value,
  ],
  () => {
    void update()
  },
)
useNativeExportBridge(
  'mindmap',
  (format, current) =>
    format === 'html'
      ? Promise.resolve(undefined)
      : onSaveScreenshot(format, current),
  async (action, current) => {
    if (action.action !== 'mindmap' || !mm)
      return { status: 'unavailable' }
    await rendering
    if (
      !current()
      || selectedNoteRecordStatus.value !== 'ready'
      || rendered?.id !== action.target.id
      || rendered.content !== selectedNote.value?.content
    ) {
      return { status: 'stale' }
    }
    if (action.command === 'collapse' || action.command === 'expand') {
      const root = mm.state.data
      if (!root)
        return { status: 'unavailable' }
      const nodeText = action.nodeText
      type MindmapNode = NonNullable<Markmap['state']['data']>
      const matches: MindmapNode[] = []
      function collect(node: MindmapNode) {
        const text = new DOMParser()
          .parseFromString(node.content, 'text/html')
          .body
          .textContent
          ?.trim()
        if (text === nodeText)
          matches.push(node)
        node.children?.forEach(collect)
      }
      if (action.nodeText)
        collect(root)
      else matches.push(root)
      if (matches.length !== 1 || !matches[0].children?.length)
        return { status: 'unavailable' }
      const node = matches[0]
      if (Boolean(node.payload?.fold) !== (action.command === 'collapse'))
        await mm.toggleNode(node)
    }
    else {
      await onZoom(action.command)
    }
    return { status: current() ? 'done' : 'stale' }
  },
)
</script>

<template>
  <div class="grid h-full grid-rows-[auto_1fr]">
    <EditorHeaderTool>
      <div class="flex w-full items-center justify-between px-2">
        <div class="flex items-center">
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
        <div class="flex items-center">
          <UiActionButton
            size="iconText"
            :tooltip="`${i18n.t('button.saveAs')} PNG`"
            @click="onSaveScreenshot('png')"
          >
            <div class="flex items-center gap-1">
              PNG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
          <UiActionButton
            size="iconText"
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
      class="h-full min-h-0 cursor-grab"
    >
      <svg
        ref="svgRef"
        class="h-full w-full"
      />
    </div>
  </div>
</template>
