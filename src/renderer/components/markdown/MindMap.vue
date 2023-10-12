<template>
  <div class="mindmap">
    <SnippetHeaderTools>
      <div class="left">
        <AppActionButton
          v-tooltip="i18n.t('button.zoomIn')"
          @click="onZoom('zoomIn')"
        >
          <UniconsPlus />
        </AppActionButton>
        <AppActionButton
          v-tooltip="i18n.t('button.zoomOut')"
          @click="onZoom('zoomOut')"
        >
          <UniconsMinus />
        </AppActionButton>
        <AppActionButton
          v-tooltip="i18n.t('button.fit')"
          @click="onZoom('fit')"
        >
          <UniconsFocus />
        </AppActionButton>
      </div>
      <div class="right">
        <AppActionButton
          v-tooltip="`${i18n.t('button.saveAs')} PNG`"
          @click="onSaveScreenshot('png')"
        >
          PNG &nbsp;
          <UniconsFileDownload />
        </AppActionButton>
        <AppActionButton
          v-tooltip="`${i18n.t('button.saveAs')} SVG`"
          @click="onSaveScreenshot('svg')"
        >
          SVG &nbsp;
          <UniconsFileDownload />
        </AppActionButton>
      </div>
    </SnippetHeaderTools>
    <div
      ref="mindmapRef"
      class="mindmap__view"
    >
      <!-- eslint-disable-next-line vue/html-self-closing ломает подсвету синтаксиса -->
      <svg ref="svgRef"></svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import { onMounted, ref, onBeforeUnmount, watch, onUpdated } from 'vue'
import { useMagicKeys } from '@vueuse/core'
import { useSnippetStore } from '@/store/snippets'
import { i18n } from '@/electron'
import domToImage from 'dom-to-image'
import { track } from '@/services/analytics'

interface Props {
  value: string
}

const props = defineProps<Props>()

const snippetStore = useSnippetStore()

const svgRef = ref<SVGElement>()
const mindmapRef = ref<HTMLDivElement>()

const transformer = new Transformer()

const { escape } = useMagicKeys()

let mm: Markmap

function init () {
  mm = Markmap.create(svgRef.value!)

  update()
}

function update () {
  const value = props.value || '# Empty'

  const { root } = transformer.transform(value)
  mm.setData(root)
  mm.fit()
}

function onZoom (type: 'zoomIn' | 'zoomOut' | 'fit') {
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

async function onSaveScreenshot (type: 'png' | 'svg' = 'png') {
  let data = ''

  await mm.fit()

  if (type === 'png') {
    data = await domToImage.toPng(mindmapRef.value!)
  }

  if (type === 'svg') {
    data = await domToImage.toSvg(mindmapRef.value!)
  }

  const a = document.createElement('a')
  a.href = data
  a.download = `${snippetStore.selected?.name}.${type}`
  a.click()

  track('snippets/save-mindmap', type)
}

onMounted(() => {
  init()
})

onUpdated(() => {
  update()
})

function fit () {
  mm.fit()
}

window.addEventListener('resize', fit)

watch(escape, () => {
  snippetStore.isMindmapPreview = false
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
})
</script>

<style lang="scss">
.mindmap {
  height: 100%;
  &__view {
    height: 100%;
    svg {
      width: 100%;
      height: calc(100% - 40px);
    }
  }

  .left,
  .right {
    display: flex;
    align-items: center;
  }
}
</style>
