<script setup lang="ts">
import {
  useApp,
  useHttpApp,
  useHttpRequests,
  useHttpSpaceInit,
} from '@/composables'
import { useAi } from '@/composables/ai/useAi'
import { useHttpAi } from '@/composables/ai/useHttpAi'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { useHttpRunner } from '@/composables/spaces/http/useHttpRunner'
import { useHttpUi } from '@/composables/spaces/http/useHttpUi'
import { useHttpWebSocket } from '@/composables/spaces/http/useHttpWebSocket'
import { useResizeHandle } from '@/composables/useResizeHandle'
import { store } from '@/electron'
import { useElementSize } from '@vueuse/core'

useHttpAi()

const { environmentsOpen } = useHttpUi()
const { open: aiOpen, setOpen: setAiOpen, setVaultContext } = useAi()
const { inspectorOpen, inspectorWidth } = useHttpPanels()
function closeInspector() {
  setAiOpen(false)
  inspectorOpen.value = false
}
const workspace = ref<HTMLElement>()
const inspectorHandle = ref<HTMLElement>()
const { width: workspaceWidth } = useElementSize(workspace)
const panelWidth = computed(() =>
  Math.min(
    Math.max(260, inspectorWidth.value),
    Math.max(260, workspaceWidth.value - 320),
  ),
)
useResizeHandle(inspectorHandle, {
  direction: 'horizontal',
  onMove(delta) {
    inspectorWidth.value = Math.min(
      Math.max(260, panelWidth.value - delta),
      Math.max(260, workspaceWidth.value - 320),
    )
  },
  onEnd() {
    store.app.set('http.layout.inspectorWidth', inspectorWidth.value)
  },
})

const { isAppLoading } = useApp()
const { initHttpSpace } = useHttpSpaceInit()
const { httpState, isHttpSidebarHidden } = useHttpApp()
const { currentRequest } = useHttpRequests()
watch(
  () => ({ request: currentRequest.value, panel: httpState.activePanel }),
  ({ request, panel }) => {
    setVaultContext(
      request
      && (!panel || panel === 'request')
      && request.protocol !== 'websocket'
        ? { type: 'http_request', id: request.id, name: request.name }
        : undefined,
    )
  },
  { immediate: true },
)
onBeforeUnmount(() => setVaultContext(undefined))

if (httpState.activePanel === 'environments') {
  httpState.activePanel
    = httpState.folderId !== undefined ? 'folder' : 'request'
}

const { open: runnerOpen } = useHttpRunner()
if (httpState.activePanel === 'runner' && !runnerOpen.value) {
  httpState.activePanel
    = httpState.folderId !== undefined ? 'folder' : 'request'
}

const { dispose: disposeWebSocket } = useHttpWebSocket()
onBeforeUnmount(disposeWebSocket)

void initHttpSpace()

const storedThreePanel = store.app.get('http.layout.threePanel') as
  | number[]
  | undefined

const sidebarWidth
  = store.app.get<number>('http.layout.treeWidth')
    ?? storedThreePanel?.[0]
    ?? 260

function onResizeEnd(width: number) {
  store.app.set('http.layout.treeWidth', width)
}
const isSidebarShown = computed(() => !isHttpSidebarHidden.value)

onMounted(() => {
  isAppLoading.value = false
})
</script>

<template>
  <LayoutThreeColumn
    :show-sidebar="isSidebarShown"
    :show-list="false"
    :sidebar-width="sidebarWidth"
    @resize-end="onResizeEnd"
  >
    <template #sidebar>
      <HttpSidebar />
    </template>
    <template #editor>
      <div
        ref="workspace"
        class="flex h-full min-w-0 overflow-hidden"
      >
        <HttpDevtoolsDock class="min-w-0 flex-1">
          <div
            class="flex h-full min-h-0 min-w-0 flex-1 flex-col"
            :class="{
              'pt-[var(--content-top-offset)]':
                httpState.activePanel === 'folder'
                || httpState.activePanel === 'runner',
            }"
          >
            <HttpContextHeader
              v-if="
                httpState.activePanel === 'folder'
                  || httpState.activePanel === 'runner'
              "
            />
            <div
              class="min-h-0 flex-1"
              :class="{
                '[--content-top-offset:0px]':
                  httpState.activePanel === 'folder'
                  || httpState.activePanel === 'runner',
              }"
            >
              <HttpRunnerPanel v-show="httpState.activePanel === 'runner'" />
              <HttpCollectionEditor v-if="httpState.activePanel === 'folder'" />
              <HttpRequestEditorPane
                v-else-if="
                  !httpState.activePanel || httpState.activePanel === 'request'
                "
              />
            </div>
          </div>
        </HttpDevtoolsDock>
        <template v-if="inspectorOpen || aiOpen">
          <div
            ref="inspectorHandle"
            class="bg-border hover:bg-primary relative z-10 w-px shrink-0 cursor-col-resize after:absolute after:inset-y-0 after:-left-1 after:w-2"
          />
          <aside
            :style="{ width: `${panelWidth}px` }"
            class="h-full min-h-0 shrink-0 overflow-hidden"
          >
            <AiInspectorTabs
              class="[--inspector-header-height:40px]"
              @close="closeInspector"
              @inspector="inspectorOpen = true"
            >
              <HttpVariablesInspector embedded />
            </AiInspectorTabs>
          </aside>
        </template>
      </div>
    </template>
  </LayoutThreeColumn>
  <HttpHistoryDialog />
  <HttpEnvironmentManagerDialog v-model:open="environmentsOpen" />
</template>
