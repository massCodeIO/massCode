<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'
import type { NodeData } from './types'
import { useDialog, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { Background } from '@vue-flow/background'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import { useDark } from '@vueuse/core'
import domToImage from 'dom-to-image'
import {
  FileDown,
  Lock,
  LockOpen,
  Maximize,
  Minus,
  Plus,
} from 'lucide-vue-next'
import { useLayout } from './composables/useLayout'
import DialogInfo from './DialogInfo.vue'
import ArrayNode from './nodes/ArrayNode.vue'
import ObjectNode from './nodes/ObjectNode.vue'
import { parseJsonToGraph } from './utils'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const { selectedSnippetContent, selectedSnippet } = useSnippets()
const isDark = useDark()
const {
  zoomIn,
  zoomOut,
  fitView,
  setInteractive,
  nodesDraggable,
  nodesConnectable,
  elementsSelectable,
} = useVueFlow()

const nodes = ref<Node<NodeData>[]>([])
const edges = ref<Edge[]>([])
const vueFlowRef = useTemplateRef('vueFlowRef')

const { layout } = useLayout()

function updateGraph() {
  const graph = parseJsonToGraph(
    JSON.parse(selectedSnippetContent.value?.value || '{}'),
  )
  nodes.value = graph.nodes
  edges.value = graph.edges

  nodes.value = layout(nodes.value, edges.value, 'LR')

  nextTick(() => {
    fitView()
  })
}

function onNodesInitialized() {
  updateGraph()
}

watch(
  selectedSnippetContent,
  () => {
    updateGraph()
  },
  { immediate: true },
)

const backgroundPatternColor = computed(() => (isDark.value ? '#666' : '#aaa'))

const nodeTypes = {
  object: ObjectNode,
  array: ArrayNode,
}

const isModalVisible = ref(false)
const selectedNodeData = ref<NodeData | null>(null)
const selectedNodeId = ref<string | null>(null)

const isInteractive = toRef(
  () =>
    nodesDraggable.value || nodesConnectable.value || elementsSelectable.value,
)

function onNodeClick(event: { node: Node<NodeData> }) {
  const node = event.node

  const { showDialog } = useDialog()

  showDialog({
    title: 'Node Content',
    content: h(DialogInfo, { node }),
  })

  selectedNodeId.value = node.id
  selectedNodeData.value = node.data ?? null
  isModalVisible.value = true
}

function onLockToggle() {
  setInteractive(!isInteractive.value)
}

function onZoom(type: 'zoomIn' | 'zoomOut' | 'fit') {
  if (type === 'zoomIn') {
    zoomIn()
  }
  else if (type === 'zoomOut') {
    zoomOut()
  }
  else if (type === 'fit') {
    fitView()
  }
}

async function onSave(format: 'png' | 'svg') {
  let data = ''

  const node = vueFlowRef.value!

  if (format === 'png') {
    data = await domToImage.toPng(vueFlowRef.value!, {
      width: node.offsetWidth * 2,
      height: node.offsetHeight * 2,
      style: {
        transform: 'scale(2)',
        transformOrigin: 'top left',
      },
    })
  }

  if (format === 'svg') {
    data = await domToImage.toSvg(vueFlowRef.value!)
  }

  const a = document.createElement('a')

  a.href = data
  a.download = `${selectedSnippet.value?.name}.${format}`
  a.click()
}

setInteractive(false)
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
          <UiActionButton
            :tooltip="i18n.t('button.lock')"
            @click="onLockToggle"
          >
            <Lock
              v-if="!isInteractive"
              class="h-3 w-3"
            />
            <LockOpen
              v-else
              class="h-3 w-3"
            />
          </UiActionButton>
        </div>
        <div>
          <UiActionButton
            type="iconText"
            :tooltip="`${i18n.t('button.saveAs')} PNG`"
            @click="onSave('png')"
          >
            <div class="flex items-center gap-1">
              PNG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
          <UiActionButton
            type="iconText"
            :tooltip="`${i18n.t('button.saveAs')} SVG`"
            @click="onSave('svg')"
          >
            <div class="flex items-center gap-1">
              SVG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
        </div>
      </div>
    </EditorHeaderTool>
    <div
      class="relative h-[calc(100%-var(--editor-tool-header-height))] overflow-hidden"
    >
      <div
        ref="vueFlowRef"
        class="bg-bg relative h-full"
      >
        <VueFlow
          v-if="nodes.length > 0"
          :nodes="nodes"
          :edges="edges"
          :node-types="nodeTypes as any"
          :default-viewport="{ zoom: 0.8 }"
          :min-zoom="0.1"
          :max-zoom="2"
          fit-view-on-init
          @node-click="onNodeClick"
          @nodes-initialized="onNodesInitialized"
        >
          <Background
            :pattern-color="backgroundPatternColor"
            :gap="16"
          />
        </VueFlow>
      </div>
      <div class="absolute bottom-3 left-3 z-10">
        <div
          v-if="nodes.length > 0"
          class="rounded bg-[var(--color-button)] px-2 py-0.5 text-sm select-none"
        >
          {{ nodes.length }} nodes | {{ edges.length }} edges
        </div>
      </div>
    </div>
  </div>
</template>
