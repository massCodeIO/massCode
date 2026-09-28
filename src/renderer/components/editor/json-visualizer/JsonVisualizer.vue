<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'
import type { NodeData } from './types'
import { useDialog, useSnippets } from '@/composables'
import { useNativeExportBridge } from '@/composables/ai/nativeBridges'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { saveRenderedArtifact } from '@/composables/useRenderedArtifactExport'
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

const {
  displayedSnippet,
  displayedSnippetContent,
  selectedSnippet,
  selectedSnippetRecordStatus,
} = useSnippets()
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

let renderedContent: string | undefined
function updateGraph() {
  renderedContent = undefined
  // Тело фрагмента ещё загружается — оставляем предыдущий граф без мигания.
  if (
    displayedSnippetContent.value
    && displayedSnippetContent.value.value === undefined
  ) {
    return
  }

  const graph = parseJsonToGraph(
    JSON.parse(displayedSnippetContent.value?.value || '{}'),
  )
  nodes.value = graph.nodes
  edges.value = graph.edges

  nodes.value = layout(nodes.value, edges.value, 'LR')
  renderedContent = displayedSnippetContent.value?.value ?? undefined

  nextTick(async () => {
    await fitView()
  })
}

function onNodesInitialized() {
  updateGraph()
}

watch(
  displayedSnippetContent,
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
    title: i18n.t('ai.native.nodeContent'),
    content: h(DialogInfo, { node }),
  })

  selectedNodeId.value = node.id
  selectedNodeData.value = node.data ?? null
  isModalVisible.value = true
}

function onLockToggle() {
  setInteractive(!isInteractive.value)
}

async function onZoom(type: 'zoomIn' | 'zoomOut' | 'fit') {
  if (type === 'zoomIn') {
    await zoomIn()
  }
  else if (type === 'zoomOut') {
    await zoomOut()
  }
  else if (type === 'fit') {
    await fitView()
  }
}

async function onSave(
  format: 'png' | 'svg',
  current: () => boolean = () => true,
) {
  const snippet = displayedSnippet.value
  const content = displayedSnippetContent.value
  if (
    !snippet
    || !content
    || typeof content.value !== 'string'
    || selectedSnippetRecordStatus.value !== 'ready'
    || selectedSnippet.value?.id !== snippet.id
  ) {
    return { status: 'stale' as const }
  }
  const baseline = content.value
  await nextTick()
  await fitView()
  if (!current() || renderedContent !== baseline)
    return { status: 'stale' as const }
  return saveRenderedArtifact(
    format,
    snippet.name,
    async () => {
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

      return data
    },
    () =>
      current()
      && selectedSnippetRecordStatus.value === 'ready'
      && selectedSnippet.value?.id === snippet.id
      && displayedSnippet.value?.id === snippet.id
      && displayedSnippetContent.value?.id === content.id
      && displayedSnippetContent.value?.value === baseline
      && renderedContent === baseline,
  )
}

setInteractive(false)
useNativeExportBridge(
  'jsonVisualizer',
  (format, current) =>
    format === 'html' ? Promise.resolve(undefined) : onSave(format, current),
  async (action, current) => {
    if (action.action !== 'jsonVisualizer' || !vueFlowRef.value)
      return { status: 'unavailable' }
    if (
      !current()
      || selectedSnippetRecordStatus.value !== 'ready'
      || displayedSnippet.value?.id !== action.target.id
      || renderedContent !== displayedSnippetContent.value?.value
    ) {
      return { status: 'stale' }
    }
    if (action.command === 'showNode' || action.command === 'copyNode') {
      if (
        action.pointer === undefined
        || (action.pointer !== '' && !action.pointer.startsWith('/'))
      ) {
        return { status: 'unavailable' }
      }
      let value: unknown = nodes.value[0]?.data?.value
      for (const encoded of action.pointer === ''
        ? []
        : action.pointer.slice(1).split('/')) {
        if (/~(?![01])/u.test(encoded))
          return { status: 'unavailable' }
        const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~')
        if (
          !value
          || typeof value !== 'object'
          || !Object.prototype.hasOwnProperty.call(value, key)
        ) {
          return { status: 'unavailable' }
        }
        value = (value as Record<string, unknown>)[key]
      }
      const node = nodes.value.find(node => node.data?.value === value)
      if (!node)
        return { status: 'unavailable' }
      if (action.command === 'showNode') {
        onNodeClick({ node })
        return { status: 'done' }
      }
      const text = JSON.stringify(node.data?.value, null, 2) || '{}'
      const copied = await useCopyToClipboard()(text)
      return {
        status: copied ? 'done' : 'failed',
        characters: copied ? text.length : undefined,
      }
    }
    if (action.command === 'lock' || action.command === 'unlock')
      setInteractive(action.command === 'unlock')
    else await onZoom(action.command)
    return {
      status: current() ? 'done' : 'stale',
      visual: { locked: !isInteractive.value },
    }
  },
)
</script>

<template>
  <div>
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
        <div class="flex items-center">
          <UiActionButton
            size="iconText"
            :tooltip="`${i18n.t('button.saveAs')} PNG`"
            @click="onSave('png')"
          >
            <div class="flex items-center gap-1">
              PNG <FileDown class="h-3 w-3" />
            </div>
          </UiActionButton>
          <UiActionButton
            size="iconText"
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
        class="bg-background relative h-full"
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
          class="bg-muted rounded px-2 py-0.5 text-sm select-none"
        >
          {{ nodes.length }} nodes | {{ edges.length }} edges
        </div>
      </div>
    </div>
  </div>
</template>
